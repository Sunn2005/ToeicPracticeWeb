package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.SubscriptionDao;
import com.toeic.model.Subscription;
import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;

@Service
public class SubscriptionService {
    private static final List<Entitlement> PRO_ENTITLEMENTS =
            List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS);

    private final SubscriptionDao subscriptionDao;
    private final Clock clock;

    @Autowired
    public SubscriptionService(SubscriptionDao subscriptionDao) {
        this(subscriptionDao, Clock.systemUTC());
    }

    public SubscriptionService(SubscriptionDao subscriptionDao, Clock clock) {
        this.subscriptionDao = subscriptionDao;
        this.clock = clock;
    }

    public SubscriptionSummary getSummary(String userId) throws Exception {
        return summary(subscriptionDao.findByUserId(userId).orElse(null), clock.millis());
    }

    public boolean hasEntitlement(String userId, Entitlement entitlement) throws Exception {
        SubscriptionSummary summary = getSummary(userId);
        return summary.effective() && summary.entitlements().contains(entitlement);
    }

    public void requireEntitlement(String userId, Entitlement entitlement) throws Exception {
        if (!hasEntitlement(userId, entitlement)) {
            throw new ApiCodeException(HttpStatus.FORBIDDEN, "PRO_REQUIRED", "Pro subscription required");
        }
    }

    public SubscriptionSummary activateOrExtend(String userId, long expiresAt, String adminUid) throws Exception {
        long now = clock.millis();
        if (expiresAt <= now) {
            throw new ApiCodeException(HttpStatus.BAD_REQUEST, "SUBSCRIPTION_EXPIRY_INVALID",
                    "Subscription expiry must be after server time");
        }
        Subscription subscription = subscriptionDao.findByUserId(userId).orElse(null);
        boolean continuing = subscription != null && subscription.getStatus() == SubscriptionStatus.ACTIVE
                && subscription.getExpiresAt() != null && subscription.getExpiresAt() > now;
        if (continuing && expiresAt <= subscription.getExpiresAt()) {
            return summary(subscription, now);
        }
        if (subscription == null) {
            subscription = new Subscription();
            subscription.setUserId(userId);
            subscription.setCreatedAt(now);
        }
        if (!continuing || subscription.getStartsAt() == null) {
            subscription.setStartsAt(now);
        }
        subscription.setPlanCode("PRO");
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setEntitlements(PRO_ENTITLEMENTS);
        subscription.setExpiresAt(expiresAt);
        subscription.setActivatedBy(adminUid);
        subscription.setRevokedBy(null);
        subscription.setRevokedAt(null);
        subscription.setUpdatedAt(now);
        subscriptionDao.save(subscription);
        return summary(subscription, now);
    }

    public SubscriptionSummary revoke(String userId, String adminUid) throws Exception {
        long now = clock.millis();
        Subscription subscription = subscriptionDao.findByUserId(userId).orElse(null);
        if (subscription == null || subscription.getStatus() == SubscriptionStatus.REVOKED) {
            return summary(subscription, now);
        }
        subscription.setStatus(SubscriptionStatus.REVOKED);
        subscription.setRevokedBy(adminUid);
        subscription.setRevokedAt(now);
        subscription.setUpdatedAt(now);
        subscriptionDao.save(subscription);
        return summary(subscription, now);
    }

    private SubscriptionSummary summary(Subscription subscription, long now) {
        if (subscription == null) {
            return new SubscriptionSummary(null, null, null, null, List.of(), false);
        }
        boolean effective = subscription.getStatus() == SubscriptionStatus.ACTIVE
                && subscription.getStartsAt() != null && subscription.getStartsAt() <= now
                && subscription.getExpiresAt() != null && now < subscription.getExpiresAt();
        return new SubscriptionSummary(subscription.getPlanCode(), subscription.getStatus(),
                subscription.getStartsAt(), subscription.getExpiresAt(), subscription.getEntitlements(), effective);
    }

    public record SubscriptionSummary(String planCode, SubscriptionStatus status, Long startsAt, Long expiresAt,
                                      List<Entitlement> entitlements, boolean effective) {
        public SubscriptionSummary {
            entitlements = entitlements == null ? List.of() : List.copyOf(entitlements);
        }
    }
}
