package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.SubscriptionDao;
import com.toeic.model.Subscription;
import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class SubscriptionServiceTests {
    private static final long NOW = 1_791_000_000_000L;
    private final MemorySubscriptionDao dao = new MemorySubscriptionDao();
    private final SubscriptionService service = new SubscriptionService(
            dao, Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));

    @Test
    void absentSubscriptionHasInactiveSummaryAndRequiresPro() throws Exception {
        var summary = service.getSummary("learner");
        assertNull(summary.planCode());
        assertNull(summary.status());
        assertNull(summary.startsAt());
        assertNull(summary.expiresAt());
        assertEquals(List.of(), summary.entitlements());
        assertFalse(summary.effective());
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_CHAT));
        var error = assertThrows(ApiCodeException.class,
                () -> service.requireEntitlement("learner", Entitlement.AI_ANALYSIS));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
        assertEquals("PRO_REQUIRED", error.getCode());
        assertEquals(0, dao.writes);
    }

    @Test
    void activeSubscriptionGrantsBothEntitlementsAtInclusiveStart() throws Exception {
        dao.records.put("learner", subscription(SubscriptionStatus.ACTIVE, NOW, NOW + 1000));
        var summary = service.getSummary("learner");
        assertEquals("PRO", summary.planCode());
        assertEquals(SubscriptionStatus.ACTIVE, summary.status());
        assertEquals(NOW, summary.startsAt());
        assertEquals(NOW + 1000, summary.expiresAt());
        assertEquals(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), summary.entitlements());
        assertTrue(summary.effective());
        assertTrue(service.hasEntitlement("learner", Entitlement.AI_CHAT));
        assertDoesNotThrow(() -> service.requireEntitlement("learner", Entitlement.AI_ANALYSIS));
        assertThrows(UnsupportedOperationException.class, () -> summary.entitlements().clear());
    }

    @Test
    void futureStartDoesNotGrantAccess() throws Exception {
        dao.records.put("learner", subscription(SubscriptionStatus.ACTIVE, NOW + 1, NOW + 1000));
        assertFalse(service.getSummary("learner").effective());
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_CHAT));
    }

    @Test
    void expiryIsExclusiveAndDoesNotDependOnStoredStatusNormalization() throws Exception {
        var stored = subscription(SubscriptionStatus.ACTIVE, NOW - 1000, NOW);
        dao.records.put("learner", stored);
        assertFalse(service.getSummary("learner").effective());
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_ANALYSIS));
        assertEquals(SubscriptionStatus.ACTIVE, stored.getStatus());
        assertEquals(0, dao.writes);
    }

    @Test
    void revokedSubscriptionCannotGrantAccessInsideItsTimeRange() throws Exception {
        dao.records.put("learner", subscription(SubscriptionStatus.REVOKED, NOW - 1000, NOW + 1000));
        assertFalse(service.getSummary("learner").effective());
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_CHAT));
    }

    @Test
    void requestedEntitlementMustBeStoredAndMissingDatesFailClosed() throws Exception {
        var stored = subscription(SubscriptionStatus.ACTIVE, NOW, NOW + 1000);
        stored.setEntitlements(List.of(Entitlement.AI_CHAT));
        dao.records.put("learner", stored);
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_ANALYSIS));
        stored.setStartsAt(null);
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_CHAT));
        stored.setStartsAt(NOW);
        stored.setExpiresAt(null);
        assertFalse(service.hasEntitlement("learner", Entitlement.AI_CHAT));
    }

    @Test
    void initialActivationPersistsExactlyProBenefitsAndServerAuditFields() throws Exception {
        service.activatePaidOrder("learner", NOW + 5000, "payos:order-1");
        var summary = service.getSummary("learner");
        var stored = dao.records.get("learner");
        assertEquals("learner", stored.getUserId());
        assertEquals("PRO", stored.getPlanCode());
        assertEquals(SubscriptionStatus.ACTIVE, stored.getStatus());
        assertEquals(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), stored.getEntitlements());
        assertEquals(NOW, stored.getStartsAt());
        assertEquals(NOW + 5000, stored.getExpiresAt());
        assertEquals("payos:order-1", stored.getActivatedBy());
        assertNull(stored.getRevokedBy());
        assertNull(stored.getRevokedAt());
        assertEquals(NOW, stored.getCreatedAt());
        assertEquals(NOW, stored.getUpdatedAt());
        assertTrue(summary.effective());
        assertEquals(1, dao.writes);
    }

    @Test
    void sameExpiryRetryPreservesAllAuditFieldsWithoutWriting() throws Exception {
        var stored = subscription(SubscriptionStatus.ACTIVE, NOW - 1000, NOW + 5000);
        dao.records.put("learner", stored);
        service.activatePaidOrder("learner", NOW + 5000, "payos:order-2");
        assertEquals(NOW - 2000, stored.getCreatedAt());
        assertEquals(NOW - 1000, stored.getUpdatedAt());
        assertEquals("payos:order-1", stored.getActivatedBy());
        assertEquals(0, dao.writes);
    }

    @Test
    void smallerActiveExpiryCannotShortenExistingAccess() throws Exception {
        var stored = subscription(SubscriptionStatus.ACTIVE, NOW - 1000, NOW + 5000);
        dao.records.put("learner", stored);
        service.activatePaidOrder("learner", NOW + 1000, "payos:order-2");
        var summary = service.getSummary("learner");
        assertEquals(NOW + 5000, summary.expiresAt());
        assertEquals(0, dao.writes);
    }

    @Test
    void extensionPreservesOriginalStartAndCreatedAt() throws Exception {
        dao.records.put("learner", subscription(SubscriptionStatus.ACTIVE, NOW - 1000, NOW + 5000));
        service.activatePaidOrder("learner", NOW + 10000, "payos:order-2");
        var stored = dao.records.get("learner");
        assertEquals(NOW + 10000, stored.getExpiresAt());
        assertEquals(NOW - 1000, stored.getStartsAt());
        assertEquals(NOW - 2000, stored.getCreatedAt());
        assertEquals(NOW, stored.getUpdatedAt());
        assertEquals("payos:order-2", stored.getActivatedBy());
        assertEquals(1, dao.writes);
    }

    @Test
    void expiredAndRevokedSubscriptionsReactivateFromServerNow() throws Exception {
        for (var status : List.of(SubscriptionStatus.EXPIRED, SubscriptionStatus.REVOKED, SubscriptionStatus.ACTIVE)) {
            var stored = subscription(status, NOW - 1000, NOW - 1);
            stored.setRevokedBy("old-admin");
            stored.setRevokedAt(NOW - 500);
            dao.records.put("learner", stored);
            service.activatePaidOrder("learner", NOW + 10000, "payos:order-2");
            var summary = service.getSummary("learner");
            assertEquals(SubscriptionStatus.ACTIVE, summary.status());
            assertEquals(NOW, summary.startsAt());
            assertTrue(summary.effective());
            assertNull(stored.getRevokedBy());
            assertNull(stored.getRevokedAt());
            assertEquals(NOW - 2000, stored.getCreatedAt());
        }
        assertEquals(3, dao.writes);
    }

    private static Subscription subscription(SubscriptionStatus status, long startsAt, long expiresAt) {
        var stored = new Subscription();
        stored.setUserId("learner");
        stored.setPlanCode("PRO");
        stored.setStatus(status);
        stored.setStartsAt(startsAt);
        stored.setExpiresAt(expiresAt);
        stored.setEntitlements(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS));
        stored.setActivatedBy("payos:order-1");
        stored.setCreatedAt(NOW - 2000);
        stored.setUpdatedAt(NOW - 1000);
        return stored;
    }

    private static class MemorySubscriptionDao implements SubscriptionDao {
        private final Map<String, Subscription> records = new HashMap<>();
        private int writes;

        @Override
        public Optional<Subscription> findByUserId(String userId) {
            return Optional.ofNullable(records.get(userId));
        }

        @Override
        public void save(Subscription subscription) {
            records.put(subscription.getUserId(), subscription);
            writes++;
        }

        @Override
        public synchronized Subscription updateAtomically(String userId, Function<Subscription, Mutation> mutation) {
            Mutation result = mutation.apply(records.get(userId));
            if (result.changed()) {
                save(result.subscription());
            }
            return result.subscription();
        }
    }
}
