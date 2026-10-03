package com.toeic.dao.firestore;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.model.Subscription;
import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class FirestoreSubscriptionDaoTests {
    private final Firestore firestore = mock(Firestore.class);
    private final CollectionReference subscriptions = mock(CollectionReference.class);
    private final DocumentReference document = mock(DocumentReference.class);
    private final DocumentSnapshot snapshot = mock(DocumentSnapshot.class);
    private final FirestoreSubscriptionDao dao = new FirestoreSubscriptionDao(firestore);

    @BeforeEach
    void setUp() {
        when(firestore.collection("subscriptions")).thenReturn(subscriptions);
        when(subscriptions.document("learner")).thenReturn(document);
        when(document.get()).thenReturn(ApiFutures.immediateFuture(snapshot));
    }

    @Test
    void readsSubscriptionFromUidDocumentAndPreservesAggregate() throws Exception {
        when(snapshot.exists()).thenReturn(true);
        when(snapshot.toObject(Subscription.class)).thenReturn(subscription("learner"));
        var result = dao.findByUserId("learner").orElseThrow();
        assertEquals("learner", result.getUserId());
        assertEquals("PRO", result.getPlanCode());
        assertEquals(SubscriptionStatus.ACTIVE, result.getStatus());
        assertEquals(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), result.getEntitlements());
        assertEquals(1000L, result.getStartsAt());
        assertEquals(5000L, result.getExpiresAt());
        assertEquals("admin-1", result.getActivatedBy());
        assertNull(result.getRevokedBy());
        assertNull(result.getRevokedAt());
        assertEquals(900L, result.getCreatedAt());
        assertEquals(1000L, result.getUpdatedAt());
    }

    @Test
    void restoresMissingLegacyUserIdFromDocumentId() throws Exception {
        when(snapshot.exists()).thenReturn(true);
        when(snapshot.getId()).thenReturn("learner");
        when(snapshot.toObject(Subscription.class)).thenReturn(subscription(null));
        assertEquals("learner", dao.findByUserId("learner").orElseThrow().getUserId());
    }

    @Test
    void missingDocumentReturnsEmpty() throws Exception {
        when(snapshot.exists()).thenReturn(false);
        assertTrue(dao.findByUserId("learner").isEmpty());
        verify(snapshot, never()).toObject(Subscription.class);
    }

    @Test
    void savesFullAggregateAtUidDocumentIncludingClearedRevocationMetadata() throws Exception {
        when(document.set(any(Subscription.class)))
                .thenReturn(ApiFutures.immediateFuture(null));
        dao.save(subscription("learner"));
        var payload = ArgumentCaptor.forClass(Subscription.class);
        // The one-argument set replaces the server-owned document, rather than merging legacy fields.
        verify(document).set(payload.capture());
        var stored = payload.getValue();
        assertEquals("learner", stored.getUserId());
        assertEquals("PRO", stored.getPlanCode());
        assertEquals(SubscriptionStatus.ACTIVE, stored.getStatus());
        assertEquals(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), stored.getEntitlements());
        assertNull(stored.getRevokedBy());
        assertNull(stored.getRevokedAt());
        assertEquals(900L, stored.getCreatedAt());
        assertEquals(1000L, stored.getUpdatedAt());
    }

    private static Subscription subscription(String userId) {
        var stored = new Subscription();
        stored.setUserId(userId);
        stored.setPlanCode("PRO");
        stored.setStatus(SubscriptionStatus.ACTIVE);
        stored.setEntitlements(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS));
        stored.setStartsAt(1000L);
        stored.setExpiresAt(5000L);
        stored.setActivatedBy("admin-1");
        stored.setRevokedBy(null);
        stored.setRevokedAt(null);
        stored.setCreatedAt(900L);
        stored.setUpdatedAt(1000L);
        return stored;
    }
}
