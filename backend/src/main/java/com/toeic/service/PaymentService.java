package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.ProPlan;
import com.toeic.model.enums.PaymentOrderStatus;
import com.toeic.model.enums.SubscriptionStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Sells Pro through PayOS. Verified webhook or admin reconciliation activates Pro: the browser redirect
 * (returnUrl) is display-only and never trusted. Webhook handling is idempotent:
 * PayOS may deliver the same event more than once, and a retry after a crash
 * must neither double-charge days nor lose the activation.
 */
@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final long PENDING_REUSE_MILLIS = 15 * 60 * 1000;
    private static final long MILLIS_PER_DAY = 24L * 60 * 60 * 1000;
    // JSON consumers using JavaScript Number must preserve the exact signed order code.
    private static final long MAX_SAFE_ORDER_CODE = 9_007_199_254_740_991L;
    private static final int ORDER_CODE_RESERVATION_ATTEMPTS = 5;
    /** Actor recorded on subscriptions activated by a paid order. */
    private static final String PAYOS_ACTOR = "PAYOS";

    private final PaymentOrderDao paymentOrderDao;
    private final PayOSClient payosClient;
    private final SubscriptionService subscriptionService;
    private final Clock clock;

    @Autowired
    public PaymentService(PaymentOrderDao paymentOrderDao, PayOSClient payosClient,
                          SubscriptionService subscriptionService) {
        this(paymentOrderDao, payosClient, subscriptionService, Clock.systemUTC());
    }

    PaymentService(PaymentOrderDao paymentOrderDao, PayOSClient payosClient,
                   SubscriptionService subscriptionService, Clock clock) {
        this.paymentOrderDao = paymentOrderDao;
        this.payosClient = payosClient;
        this.subscriptionService = subscriptionService;
        this.clock = clock;
    }

    public record CreatePaymentResult(String checkoutUrl, long orderCode) { }

    public record PlanOption(String planCode, long amount, int durationDays, boolean trial, boolean trialUsed) { }

    public List<PlanOption> availablePlans(String userId) throws Exception {
        List<PlanOption> plans = new java.util.ArrayList<>();
        for (ProPlan plan : ProPlan.values()) {
            boolean trial = plan == ProPlan.PRO_1DAY;
            boolean trialUsed = trial && paymentOrderDao.existsPaidOrder(userId, plan.code());
            plans.add(new PlanOption(plan.code(), plan.amount(), plan.durationDays(), trial, trialUsed));
        }
        return plans;
    }

    public CreatePaymentResult createProPayment(String userId, String planCode) throws Exception {
        ProPlan plan = ProPlan.fromCode(planCode)
                .orElseThrow(() -> new ApiCodeException(HttpStatus.BAD_REQUEST, "PAYMENT_PLAN_INVALID",
                        "Unknown Pro plan: " + planCode));
        if (plan == ProPlan.PRO_1DAY && paymentOrderDao.existsPaidOrder(userId, plan.code())) {
            throw new ApiCodeException(HttpStatus.FORBIDDEN, "PAYMENT_TRIAL_ALREADY_USED",
                    "The 1-day trial plan can only be purchased once per account");
        }
        long now = clock.millis();

        // Reuse a fresh pending order instead of spamming PayOS with duplicate links.
        var pending = paymentOrderDao.findLatestPending(userId, plan.code());
        if (pending.isPresent() && now - pending.get().getCreatedAt() < PENDING_REUSE_MILLIS
                && pending.get().getCheckoutUrl() != null) {
            return new CreatePaymentResult(pending.get().getCheckoutUrl(), pending.get().getOrderCode());
        }

        PaymentOrder order = new PaymentOrder();
        order.setUserId(userId);
        order.setPlanCode(plan.code());
        order.setAmount(plan.amount());
        order.setDurationDays(plan.durationDays());
        order.setStatus(PaymentOrderStatus.PENDING);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        reserveOrder(order);
        try {
            PayOSClient.PaymentLink link = payosClient.createPaymentLink(
                    order.getOrderCode(), plan.amount(), plan.payosDescription());
            order.setPaymentLinkId(link.paymentLinkId());
            order.setCheckoutUrl(link.checkoutUrl());
            order.setUpdatedAt(clock.millis());
            paymentOrderDao.save(order);
            return new CreatePaymentResult(link.checkoutUrl(), order.getOrderCode());
        } catch (Exception exception) {
            log.warn("PayOS create payment link failed for order {}: {}",
                    order.getOrderCode(), exception.getMessage(), exception);
            cancelQuietly(order);
            throw new ApiCodeException(HttpStatus.BAD_GATEWAY, "PAYOS_UNAVAILABLE",
                    "PayOS could not create a payment link");
        }
    }

    public record WebhookResult(boolean handled, String reason) { }

    public void reconcile(long orderCode) throws Exception {
        PaymentOrder order = paymentOrderDao.findByOrderCode(orderCode).orElseThrow(() ->
                new ApiCodeException(HttpStatus.NOT_FOUND, "PAYMENT_ORDER_NOT_FOUND", "Payment order not found"));
        if (order.getStatus() == PaymentOrderStatus.CANCELLED) {
            throw new ApiCodeException(HttpStatus.CONFLICT, "PAYMENT_ORDER_CANCELLED", "Order is cancelled");
        }
        PayOSClient.PaymentInfo info = payosClient.getPaymentInfo(orderCode);
        if (info.orderCode() != orderCode || order.getPaymentLinkId() == null
                || !order.getPaymentLinkId().equals(info.paymentLinkId())
                || order.getAmount() <= 0 || order.getDurationDays() <= 0
                || info.amount() != order.getAmount()) {
            throw new ApiCodeException(HttpStatus.CONFLICT, "PAYMENT_ORDER_MISMATCH",
                    "PayOS information does not match this order");
        }
        if (!"PAID".equals(info.status()) || info.amountPaid() < order.getAmount()
                || info.amountRemaining() != 0) {
            throw new ApiCodeException(HttpStatus.CONFLICT, "PAYMENT_NOT_PAID",
                    "PayOS has not confirmed full payment");
        }
        // Lookup does not supply a reliable payment timestamp. Do not fabricate one
        // for revenue reports; an already recorded paidAt is preserved.
        if (!applyPaidOrder(order, clock.millis(), null).handled()) {
            throw new ApiCodeException(HttpStatus.CONFLICT, "PAYMENT_ORDER_CANCELLED", "Order is not payable");
        }
        log.info("PayOS reconciliation completed for order {}", orderCode);
    }

    @SuppressWarnings("unchecked")
    public WebhookResult handleWebhook(Map<String, Object> payload) throws Exception {
        if (payload == null) {
            throw new ApiCodeException(HttpStatus.BAD_REQUEST, "PAYMENT_WEBHOOK_INVALID", "Empty webhook payload");
        }
        Object dataObject = payload.get("data");
        if (!(dataObject instanceof Map<?, ?> data)) {
            throw new ApiCodeException(HttpStatus.BAD_REQUEST, "PAYMENT_WEBHOOK_INVALID", "Webhook payload has no data");
        }
        String signature = payload.get("signature") instanceof String value ? value : null;
        if (!payosClient.verifyWebhookSignature((Map<String, Object>) data, signature)) {
            throw new ApiCodeException(HttpStatus.BAD_REQUEST, "PAYMENT_WEBHOOK_SIGNATURE_INVALID",
                    "Webhook signature verification failed");
        }
        // Only a successful payment activates Pro. Anything else (cancelled, failed)
        // is acknowledged without side effects so PayOS stops retrying it.
        if (!"00".equals(string(data.get("code")))) {
            return new WebhookResult(false, "not a successful payment");
        }
        long orderCode;
        try {
            orderCode = Long.parseLong(string(data.get("orderCode")));
        } catch (NumberFormatException exception) {
            log.warn("PayOS webhook with invalid orderCode: {}", data.get("orderCode"));
            return new WebhookResult(false, "invalid orderCode");
        }
        var orderOpt = paymentOrderDao.findByOrderCode(orderCode);
        if (orderOpt.isEmpty()) {
            // Unknown order (e.g. PayOS dashboard webhook-confirm test): acknowledge, do nothing.
            return new WebhookResult(false, "unknown order");
        }
        PaymentOrder order = orderOpt.get();
        long paidAmount = number(data.get("amount"));
        if (paidAmount != order.getAmount()) {
            log.warn("PayOS webhook amount mismatch for order {}: got {}, expected {}",
                    orderCode, paidAmount, order.getAmount());
            return new WebhookResult(false, "amount mismatch");
        }
        if (order.getStatus() == PaymentOrderStatus.CANCELLED) {
            return new WebhookResult(false, "order cancelled");
        }
        return applyPaidOrder(order, clock.millis(), clock.millis());
    }

    private WebhookResult applyPaidOrder(PaymentOrder order, long now, Long paidAt) throws Exception {
        long orderCode = order.getOrderCode();
        if (order.getStatus() == PaymentOrderStatus.PENDING) {
            // Atomic flip: only the first delivery (or first concurrent attempt) wins.
            // Retries observe PAID below and reuse the stored expiry.
            order = paymentOrderDao.updateAtomically(orderCode, current -> {
                if (current == null || current.getStatus() != PaymentOrderStatus.PENDING) {
                    return new PaymentOrderDao.Mutation(current, false);
                }
                current.setStatus(PaymentOrderStatus.PAID);
                current.setPaidAt(paidAt);
                current.setUpdatedAt(now);
                return new PaymentOrderDao.Mutation(current, true);
            });
        }
        if (order == null || order.getStatus() != PaymentOrderStatus.PAID) {
            return new WebhookResult(false, "order is not payable");
        }
        ensureActivation(order, now);
        return new WebhookResult(true, "activated");
    }

    /**
     * Activates Pro for a PAID order. The expiry is computed once and stored on the
     * order, so a retried webhook reuses it: remaining Pro days are topped up
     * (base = max(now, current expiry)) and never double-charged.
     */
    private void ensureActivation(PaymentOrder order, long now) throws Exception {
        if (order.getProExpiresAt() == null) {
            var summary = subscriptionService.getSummary(order.getUserId());
            long base = summary.status() == SubscriptionStatus.ACTIVE
                    && summary.expiresAt() != null && summary.expiresAt() > now
                    ? summary.expiresAt() : now;
            long proExpiresAt = base + (long) order.getDurationDays() * MILLIS_PER_DAY;
            paymentOrderDao.updateAtomically(order.getOrderCode(), current -> {
                if (current == null || current.getProExpiresAt() != null) {
                    return new PaymentOrderDao.Mutation(current, false);
                }
                current.setProExpiresAt(proExpiresAt);
                current.setUpdatedAt(now);
                return new PaymentOrderDao.Mutation(current, true);
            });
            order = paymentOrderDao.findByOrderCode(order.getOrderCode()).orElse(order);
        }
        subscriptionService.activatePaidOrder(order.getUserId(), order.getProExpiresAt(), PAYOS_ACTOR);
    }

    private void cancelQuietly(PaymentOrder order) {
        try {
            paymentOrderDao.updateAtomically(order.getOrderCode(), current -> {
                if (current == null || current.getStatus() != PaymentOrderStatus.PENDING) {
                    return new PaymentOrderDao.Mutation(current, false);
                }
                current.setStatus(PaymentOrderStatus.CANCELLED);
                current.setUpdatedAt(clock.millis());
                return new PaymentOrderDao.Mutation(current, true);
            });
        } catch (Exception ignored) {
            log.warn("Could not cancel payment order {}", order.getOrderCode());
        }
    }

    private void reserveOrder(PaymentOrder order) throws Exception {
        for (int attempt = 0; attempt < ORDER_CODE_RESERVATION_ATTEMPTS; attempt++) {
            order.setOrderCode(ThreadLocalRandom.current().nextLong(1, MAX_SAFE_ORDER_CODE + 1));
            PaymentOrder reserved = paymentOrderDao.updateAtomically(order.getOrderCode(), current -> {
                if (current != null) {
                    // A null result signals a collision without changing the existing document.
                    return new PaymentOrderDao.Mutation(null, false);
                }
                return new PaymentOrderDao.Mutation(order, true);
            });
            if (reserved != null) {
                return;
            }
        }
        throw new IllegalStateException("Could not reserve a unique payment order code");
    }

    private static String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static long number(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(string(value));
        } catch (NumberFormatException exception) {
            return -1;
        }
    }
}
