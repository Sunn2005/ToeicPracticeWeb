package com.toeic.service;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.toeic.dao.firestore.FirestoreSubscriptionDao;
import com.toeic.model.Subscription;
import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SubscriptionConcurrencyTests {
    private static final long NOW = 1_791_000_000_000L;

    @Test
    void staleShorterExtensionCannotOverwriteTheLongerCommittedExtension() throws Exception {
        var boundary = new ConcurrentFirestoreBoundary();
        var service = boundary.service();
        try (var executor = Executors.newSingleThreadExecutor(r -> new Thread(r, "delayed-subscription"))) {
            var shorter = executor.submit(() -> service.activateOrExtend("learner", NOW + 10_000, "short-admin"));
            try {
                assertTrue(boundary.snapshotCaptured.await(5, TimeUnit.SECONDS));
                service.activateOrExtend("learner", NOW + 20_000, "long-admin");
            } finally {
                boundary.otherCommitted.countDown();
            }
            var result = shorter.get(5, TimeUnit.SECONDS);
            var stored = boundary.current();
            assertEquals(NOW + 20_000, stored.getExpiresAt());
            assertEquals("long-admin", stored.getActivatedBy());
            assertEquals(NOW + 20_000, result.expiresAt());
            assertEquals(NOW - 2000, stored.getCreatedAt());
            assertEquals(1, boundary.retries);
            assertEquals(1, boundary.writes);
        }
    }

    @Test
    void staleRevocationPreservesTheCommittedExtensionAndItsAuditActor() throws Exception {
        var boundary = new ConcurrentFirestoreBoundary();
        var service = boundary.service();
        try (var executor = Executors.newSingleThreadExecutor(r -> new Thread(r, "delayed-subscription"))) {
            var revocation = executor.submit(() -> service.revoke("learner", "revoke-admin"));
            try {
                assertTrue(boundary.snapshotCaptured.await(5, TimeUnit.SECONDS));
                service.activateOrExtend("learner", NOW + 20_000, "long-admin");
            } finally {
                boundary.otherCommitted.countDown();
            }
            assertFalse(revocation.get(5, TimeUnit.SECONDS).effective());
            var stored = boundary.current();
            assertEquals(SubscriptionStatus.REVOKED, stored.getStatus());
            assertEquals(NOW + 20_000, stored.getExpiresAt());
            assertEquals("long-admin", stored.getActivatedBy());
            assertEquals("revoke-admin", stored.getRevokedBy());
            assertEquals(NOW, stored.getRevokedAt());
            assertEquals(NOW - 2000, stored.getCreatedAt());
            assertEquals(1, boundary.retries);
        }
    }

    /** Models Firestore's version-conflict retry at the external boundary, using independent snapshots. */
    private static class ConcurrentFirestoreBoundary {
        private final Firestore firestore = mock(Firestore.class);
        private final DocumentReference document = mock(DocumentReference.class);
        private final CountDownLatch snapshotCaptured = new CountDownLatch(1);
        private final CountDownLatch otherCommitted = new CountDownLatch(1);
        private final AtomicBoolean delayFirstSnapshot = new AtomicBoolean(true);
        private Subscription stored = initialSubscription();
        private int version;
        private int retries;
        private int writes;

        private ConcurrentFirestoreBoundary() {
            var collection = mock(CollectionReference.class);
            when(firestore.collection("subscriptions")).thenReturn(collection);
            when(collection.document("learner")).thenReturn(document);
            when(document.get()).thenAnswer(ignored -> ApiFutures.immediateFuture(snapshot(read())));
            when(document.set(any(Subscription.class))).thenAnswer(invocation -> {
                synchronized (this) {
                    stored = copy(invocation.getArgument(0));
                    version++;
                    writes++;
                }
                return ApiFutures.immediateFuture(null);
            });
            when(firestore.runTransaction(any())).thenAnswer(invocation -> {
                Transaction.Function<Subscription> callback = invocation.getArgument(0);
                for (int attempt = 0; attempt < 5; attempt++) {
                    var transaction = mock(Transaction.class);
                    var read = new AtomicReference<Read>();
                    var pending = new AtomicReference<Subscription>();
                    when(transaction.get(document)).thenAnswer(ignored -> {
                        read.set(read());
                        return ApiFutures.immediateFuture(snapshot(read.get()));
                    });
                    when(transaction.set(eq(document), any(Subscription.class))).thenAnswer(write -> {
                        pending.set(copy(write.getArgument(1)));
                        return transaction;
                    });
                    Subscription result = callback.updateCallback(transaction);
                    synchronized (this) {
                        if (read.get().version() != version) {
                            retries++;
                            continue;
                        }
                        if (pending.get() != null) {
                            stored = copy(pending.get());
                            version++;
                            writes++;
                        }
                        return ApiFutures.immediateFuture(result);
                    }
                }
                throw new AssertionError("Transaction exceeded retry limit");
            });
        }

        private SubscriptionService service() {
            return new SubscriptionService(new FirestoreSubscriptionDao(firestore),
                    Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));
        }

        private synchronized Read read() {
            return new Read(copy(stored), version);
        }

        private synchronized Subscription current() {
            return copy(stored);
        }

        private DocumentSnapshot snapshot(Read read) throws InterruptedException {
            if (Thread.currentThread().getName().equals("delayed-subscription")
                    && delayFirstSnapshot.compareAndSet(true, false)) {
                snapshotCaptured.countDown();
                assertTrue(otherCommitted.await(5, TimeUnit.SECONDS));
            }
            var snapshot = mock(DocumentSnapshot.class);
            when(snapshot.exists()).thenReturn(true);
            when(snapshot.toObject(Subscription.class)).thenReturn(copy(read.subscription()));
            return snapshot;
        }

        private record Read(Subscription subscription, int version) { }
    }

    private static Subscription initialSubscription() {
        var stored = new Subscription();
        stored.setUserId("learner");
        stored.setPlanCode("PRO");
        stored.setStatus(SubscriptionStatus.ACTIVE);
        stored.setEntitlements(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS));
        stored.setStartsAt(NOW - 1000);
        stored.setExpiresAt(NOW + 5000);
        stored.setActivatedBy("original-admin");
        stored.setCreatedAt(NOW - 2000);
        stored.setUpdatedAt(NOW - 1000);
        return stored;
    }

    private static Subscription copy(Subscription source) {
        var copy = new Subscription();
        copy.setUserId(source.getUserId());
        copy.setPlanCode(source.getPlanCode());
        copy.setStatus(source.getStatus());
        copy.setEntitlements(source.getEntitlements() == null ? null : List.copyOf(source.getEntitlements()));
        copy.setStartsAt(source.getStartsAt());
        copy.setExpiresAt(source.getExpiresAt());
        copy.setActivatedBy(source.getActivatedBy());
        copy.setRevokedBy(source.getRevokedBy());
        copy.setRevokedAt(source.getRevokedAt());
        copy.setCreatedAt(source.getCreatedAt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }
}
