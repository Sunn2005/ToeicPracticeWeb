package com.toeic.service;

import com.toeic.config.PayOSProperties;
import com.toeic.controller.ApiCodeException;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.dao.SubscriptionDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.Subscription;
import com.toeic.model.enums.PaymentOrderStatus;
import com.toeic.model.enums.SubscriptionStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

class PaymentServiceTests {
    private static final long NOW = 1_791_000_000_000L;
    private static final long DAY = 24L * 60 * 60 * 1000;

    private final MemoryPaymentOrderDao orderDao = new MemoryPaymentOrderDao();
    private final MemorySubscriptionDao subscriptionDao = new MemorySubscriptionDao();
    private final SubscriptionService subscriptionService = new SubscriptionService(
            subscriptionDao, Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));
    private final StubPayOSClient payosClient = new StubPayOSClient();
    private final PaymentService service = new PaymentService(orderDao, payosClient, subscriptionService,
            Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));

    @Test
    void unknownPlanIsRejected() {
        var error = assertThrows(ApiCodeException.class, () -> service.createProPayment("learner", "NOPE"));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        assertEquals("PAYMENT_PLAN_INVALID", error.getCode());
    }

    @Test
    void trialPlanCanBeBoughtOnlyOncePerAccount() throws Exception {
        var created = service.createProPayment("learner", "PRO_1DAY");
        service.handleWebhook(signedPayload(created.orderCode(), 10_000L, "00"));
        assertEquals(PaymentOrderStatus.PAID, orderDao.records.get(created.orderCode()).getStatus());

        var error = assertThrows(ApiCodeException.class, () -> service.createProPayment("learner", "PRO_1DAY"));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
        assertEquals("PAYMENT_TRIAL_ALREADY_USED", error.getCode());

        // A different account can still buy the trial.
        var other = service.createProPayment("someone-else", "PRO_1DAY");
        assertTrue(other.checkoutUrl().startsWith("https://payos.test/checkout/"));
    }

    @Test
    void trialPlanIsListedWithUsageFlag() throws Exception {
        var plans = service.availablePlans("learner");
        assertEquals(List.of("PRO_30", "PRO_1DAY"),
                plans.stream().map(PaymentService.PlanOption::planCode).toList());
        var trial = plans.stream().filter(p -> p.planCode().equals("PRO_1DAY")).findFirst().orElseThrow();
        assertTrue(trial.trial());
        assertFalse(trial.trialUsed());

        var created = service.createProPayment("learner", "PRO_1DAY");
        service.handleWebhook(signedPayload(created.orderCode(), 10_000L, "00"));

        var used = service.availablePlans("learner").stream()
                .filter(p -> p.planCode().equals("PRO_1DAY")).findFirst().orElseThrow();
        assertTrue(used.trialUsed());
    }

    @Test
    void createReturnsCheckoutUrlAndReusesFreshPendingOrder() throws Exception {
        var first = service.createProPayment("learner", "PRO_30");
        assertTrue(first.checkoutUrl().startsWith("https://payos.test/checkout/"));
        assertEquals(1, payosClient.createdLinks);
        assertEquals(1, orderDao.records.size());

        var second = service.createProPayment("learner", "PRO_30");
        assertEquals(first.checkoutUrl(), second.checkoutUrl());
        assertEquals(first.orderCode(), second.orderCode());
        assertEquals(1, payosClient.createdLinks);
    }

    @Test
    void newOrderCodesRemainExactWhenReadAsJavaScriptNumbers() throws Exception {
        for (int i = 0; i < 100; i++) {
            var created = service.createProPayment("learner-" + i, "PRO_30");
            long orderCode = created.orderCode();
            assertTrue(orderCode > 0 && orderCode <= 9_007_199_254_740_991L);
            assertEquals(orderCode, (long) (double) orderCode);
            assertEquals(orderCode, orderDao.records.get(orderCode).getOrderCode());
        }
        assertEquals(100, orderDao.records.size());
    }

    @Test
    void orderCodeCollisionRetriesWithoutOverwritingExistingOrder() throws Exception {
        PaymentOrder existing = new PaymentOrder();
        existing.setUserId("existing-owner");
        existing.setPlanCode("PRO_1DAY");
        existing.setAmount(10_000L);
        existing.setStatus(PaymentOrderStatus.PAID);
        var collidingDao = new MemoryPaymentOrderDao() {
            @Override
            public PaymentOrder updateAtomically(long orderCode, Function<PaymentOrder, Mutation> mutation) {
                if (records.isEmpty()) {
                    existing.setOrderCode(orderCode);
                    records.put(orderCode, existing);
                }
                return super.updateAtomically(orderCode, mutation);
            }
        };
        var collisionService = new PaymentService(collidingDao, payosClient, subscriptionService,
                Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));

        var created = collisionService.createProPayment("learner", "PRO_30");

        assertNotEquals(existing.getOrderCode(), created.orderCode());
        assertSame(existing, collidingDao.records.get(existing.getOrderCode()));
        assertEquals("existing-owner", existing.getUserId());
        assertEquals(PaymentOrderStatus.PAID, existing.getStatus());
        assertEquals(2, collidingDao.records.size());
        assertEquals("learner", collidingDao.records.get(created.orderCode()).getUserId());
        assertEquals(1, payosClient.createdLinks);
    }

    @Test
    void repeatedOrderCodeCollisionsStopBeforeCallingPayOS() {
        var collidingDao = new MemoryPaymentOrderDao() {
            @Override
            public PaymentOrder updateAtomically(long orderCode, Function<PaymentOrder, Mutation> mutation) {
                PaymentOrder existing = new PaymentOrder();
                existing.setOrderCode(orderCode);
                existing.setUserId("existing-owner");
                existing.setStatus(PaymentOrderStatus.PAID);
                records.put(orderCode, existing);
                return super.updateAtomically(orderCode, mutation);
            }
        };
        var collisionService = new PaymentService(collidingDao, payosClient, subscriptionService,
                Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));

        assertThrows(IllegalStateException.class, () -> collisionService.createProPayment("learner", "PRO_30"));

        assertEquals(5, collidingDao.records.size());
        assertTrue(collidingDao.records.values().stream()
                .allMatch(order -> "existing-owner".equals(order.getUserId())
                        && order.getStatus() == PaymentOrderStatus.PAID));
        assertEquals(0, payosClient.createdLinks);
    }

    @Test
    void webhookRejectsBadSignature() {
        Map<String, Object> payload = webhookPayload(1L, 99_000L, "00", "bad-signature");
        var error = assertThrows(ApiCodeException.class, () -> service.handleWebhook(payload));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatus());
        assertEquals("PAYMENT_WEBHOOK_SIGNATURE_INVALID", error.getCode());
    }

    @Test
    void webhookIgnoresUnknownOrderAmountMismatchAndNonSuccess() throws Exception {
        var created = service.createProPayment("learner", "PRO_30");
        long orderCode = created.orderCode();

        var unknown = service.handleWebhook(signedPayload(999L, 99_000L, "00"));
        assertFalse(unknown.handled());

        var mismatch = service.handleWebhook(signedPayload(orderCode, 1L, "00"));
        assertFalse(mismatch.handled());
        assertEquals(PaymentOrderStatus.PENDING, orderDao.records.get(orderCode).getStatus());

        var cancelled = service.handleWebhook(signedPayload(orderCode, 99_000L, "01"));
        assertFalse(cancelled.handled());
        assertEquals(PaymentOrderStatus.PENDING, orderDao.records.get(orderCode).getStatus());
        assertNull(subscriptionDao.records.get("learner"));
    }

    @Test
    void webhookActivatesProForThirtyDays() throws Exception {
        var created = service.createProPayment("learner", "PRO_30");
        var result = service.handleWebhook(signedPayload(created.orderCode(), 99_000L, "00"));
        assertTrue(result.handled());

        PaymentOrder order = orderDao.records.get(created.orderCode());
        assertEquals(PaymentOrderStatus.PAID, order.getStatus());
        assertEquals(NOW + 30 * DAY, order.getProExpiresAt());

        var summary = subscriptionService.getSummary("learner");
        assertTrue(summary.effective());
        assertEquals("PRO", summary.planCode());
        assertEquals(NOW + 30 * DAY, summary.expiresAt());
    }

    @Test
    void webhookTopsUpRemainingDaysInsteadOfResetting() throws Exception {
        subscriptionDao.records.put("learner", subscription(NOW, NOW + 10 * DAY));
        var created = service.createProPayment("learner", "PRO_30");
        service.handleWebhook(signedPayload(created.orderCode(), 99_000L, "00"));

        var summary = subscriptionService.getSummary("learner");
        assertEquals(NOW + 40 * DAY, summary.expiresAt());
    }

    @Test
    void retriedWebhookReusesStoredExpiryAndDoesNotDoubleExtend() throws Exception {
        var created = service.createProPayment("learner", "PRO_30");
        Map<String, Object> payload = signedPayload(created.orderCode(), 99_000L, "00");
        assertTrue(service.handleWebhook(payload).handled());
        assertTrue(service.handleWebhook(payload).handled());

        var summary = subscriptionService.getSummary("learner");
        assertEquals(NOW + 30 * DAY, summary.expiresAt());
        assertEquals(PaymentOrderStatus.PAID, orderDao.records.get(created.orderCode()).getStatus());
    }

    @Test
    void retriedWebhookDoesNotUndoALaterAdminRevocation() throws Exception {
        var created = service.createProPayment("learner", "PRO_30");
        Map<String, Object> payload = signedPayload(created.orderCode(), 99_000L, "00");
        service.handleWebhook(payload);
        subscriptionService.revoke("learner", "admin-1");

        assertTrue(service.handleWebhook(payload).handled());

        var summary = subscriptionService.getSummary("learner");
        assertEquals(SubscriptionStatus.REVOKED, summary.status());
        assertFalse(summary.effective());
    }

    private Map<String, Object> signedPayload(long orderCode, long amount, String code) {
        return webhookPayload(orderCode, amount, code, null);
    }

    private Map<String, Object> webhookPayload(long orderCode, long amount, String code, String signature) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderCode", orderCode);
        data.put("amount", amount);
        data.put("code", code);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", "00");
        payload.put("desc", "success");
        payload.put("data", data);
        payload.put("signature", signature != null ? signature : payosClient.sign(data));
        return payload;
    }

    private static Subscription subscription(long startsAt, long expiresAt) {
        var sub = new Subscription();
        sub.setUserId("learner");
        sub.setPlanCode("PRO");
        sub.setStatus(SubscriptionStatus.ACTIVE);
        sub.setStartsAt(startsAt);
        sub.setExpiresAt(expiresAt);
        return sub;
    }

    static class StubPayOSClient extends PayOSClient {
        int createdLinks = 0;

        StubPayOSClient() {
            super(properties(), new ObjectMapper());
        }

        @Override
        public PaymentLink createPaymentLink(long orderCode, long amount, String description) {
            createdLinks++;
            return new PaymentLink("https://payos.test/checkout/" + orderCode, "link-" + orderCode);
        }

        private static PayOSProperties properties() {
            var props = new PayOSProperties();
            props.setChecksumKey("checksum-key");
            return props;
        }
    }

    static class MemoryPaymentOrderDao implements PaymentOrderDao {
        final Map<Long, PaymentOrder> records = new HashMap<>();

        @Override
        public java.util.List<PaymentOrder> findAll() {
            return java.util.List.copyOf(records.values());
        }

        @Override
        public void save(PaymentOrder order) {
            records.put(order.getOrderCode(), order);
        }

        @Override
        public Optional<PaymentOrder> findByOrderCode(long orderCode) {
            return Optional.ofNullable(records.get(orderCode));
        }

        @Override
        public Optional<PaymentOrder> findLatestPending(String userId, String planCode) {
            return records.values().stream()
                    .filter(o -> o.getUserId().equals(userId) && o.getPlanCode().equals(planCode)
                            && o.getStatus() == PaymentOrderStatus.PENDING)
                    .max((a, b) -> Long.compare(a.getCreatedAt(), b.getCreatedAt()));
        }

        @Override
        public boolean existsPaidOrder(String userId, String planCode) {
            return records.values().stream()
                    .anyMatch(o -> o.getUserId().equals(userId) && o.getPlanCode().equals(planCode)
                            && o.getStatus() == PaymentOrderStatus.PAID);
        }

        @Override
        public PaymentOrder updateAtomically(long orderCode, Function<PaymentOrder, Mutation> mutation) {
            Mutation result = mutation.apply(records.get(orderCode));
            if (result.changed()) {
                records.put(orderCode, result.order());
            }
            return result.order();
        }
    }

    static class MemorySubscriptionDao implements SubscriptionDao {
        final Map<String, Subscription> records = new HashMap<>();

        @Override
        public Optional<Subscription> findByUserId(String userId) {
            return Optional.ofNullable(records.get(userId));
        }

        @Override
        public void save(Subscription subscription) {
            records.put(subscription.getUserId(), subscription);
        }

        @Override
        public Subscription updateAtomically(String userId, Function<Subscription, Mutation> mutation) {
            Mutation result = mutation.apply(records.get(userId));
            if (result.changed()) {
                records.put(userId, result.subscription());
            }
            return result.subscription();
        }
    }
}
