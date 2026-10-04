package com.toeic.service;

import com.toeic.dao.UserDao;
import com.toeic.dao.SubscriptionDao;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.Subscription;
import com.toeic.model.User;
import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import com.toeic.model.enums.UserRole;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.List;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CurrentUserServiceTests {

    @Test
    void createsAUserProfileWithTheDefaultUserRole() throws Exception {
        UserDao userDao = mock(UserDao.class);
        CurrentUserService service = new CurrentUserService(userDao, mock(SubscriptionService.class));
        FirebaseIdentity identity = new FirebaseIdentity(
                "uid-1", "user@example.com", "User", null, "ADMIN"
        );
        when(userDao.findByUid("uid-1")).thenReturn(Optional.empty());

        User result = service.requireUser(identity);

        assertEquals(UserRole.USER, result.getRole());
        verify(userDao).save(any(User.class));
    }

    @Test
    void createsAUserFromVerifiedIdentityWithoutTrustingItsRoleClaim() throws Exception {
        UserDao userDao = mock(UserDao.class);
        CurrentUserService service = new CurrentUserService(userDao, mock(SubscriptionService.class));
        FirebaseIdentity identity = new FirebaseIdentity(
                "uid-1",
                "user@example.com",
                "User",
                null,
                "ADMIN"
        );
        when(userDao.findByUid("uid-1")).thenReturn(Optional.empty());

        User result = service.requireUser(identity);

        assertEquals(UserRole.USER, result.getRole());
        verify(userDao).save(any(User.class));
    }

    @Test
    void repairsLegacyProfileWithoutRoleAsUser() throws Exception {
        UserDao userDao = mock(UserDao.class);
        CurrentUserService service = new CurrentUserService(userDao, mock(SubscriptionService.class));
        User legacyUser = new User();
        legacyUser.setUid("uid-legacy");
        FirebaseIdentity identity = new FirebaseIdentity(
                "uid-legacy", null, null, null, "ADMIN"
        );
        when(userDao.findByUid("uid-legacy")).thenReturn(Optional.of(legacyUser));

        User result = service.requireUser(identity);

        assertEquals(UserRole.USER, result.getRole());
        verify(userDao).save(legacyUser);
    }

    @Test
    void updatesTheLearnerProfileAndTargetScore() throws Exception {
        UserDao userDao = mock(UserDao.class);
        SubscriptionService subscriptionService = mock(SubscriptionService.class);
        when(subscriptionService.getSummary("uid-1")).thenReturn(new SubscriptionService.SubscriptionSummary(
                "PRO", SubscriptionStatus.ACTIVE, 1000L, 3000L,
                List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), true));
        CurrentUserService service = new CurrentUserService(userDao, subscriptionService);
        User user = new User();
        user.setUid("uid-1");
        user.setEmail("user@example.com");
        user.setRole(UserRole.USER);
        when(userDao.findByUid("uid-1")).thenReturn(Optional.of(user));

        var response = service.updateProfile("uid-1", "Minh Anh", null, 800);

        assertEquals("Minh Anh", response.get("displayName"));
        assertEquals(800, response.get("targetScore"));
        assertEquals(new SubscriptionService.SubscriptionSummary(
                "PRO", SubscriptionStatus.ACTIVE, 1000L, 3000L,
                List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), true), response.get("subscription"));
        verify(userDao).save(user);
    }

    @Test
    void profileIncludesInactiveDerivedSummaryWhenSubscriptionIsAbsent() throws Exception {
        UserDao userDao = mock(UserDao.class);
        SubscriptionDao subscriptionDao = mock(SubscriptionDao.class);
        User user = new User();
        user.setUid("uid-1");
        user.setRole(UserRole.USER);
        when(userDao.findByUid("uid-1")).thenReturn(Optional.of(user));
        when(subscriptionDao.findByUserId("uid-1")).thenReturn(Optional.empty());
        CurrentUserService service = new CurrentUserService(userDao, new SubscriptionService(subscriptionDao));

        var response = service.getProfile("uid-1");

        var summary = (SubscriptionService.SubscriptionSummary) response.get("subscription");
        assertNotNull(summary);
        assertNull(summary.planCode());
        assertNull(summary.status());
        assertNull(summary.startsAt());
        assertNull(summary.expiresAt());
        assertEquals(List.of(), summary.entitlements());
        assertFalse(summary.effective());
        assertEquals("USER", response.get("role"));
    }

    @Test
    void profileIncludesExactActiveProSummaryFromSubscriptionService() throws Exception {
        UserDao userDao = mock(UserDao.class);
        SubscriptionDao subscriptionDao = mock(SubscriptionDao.class);
        User user = new User();
        user.setUid("uid-1");
        user.setRole(UserRole.EMPLOYEE);
        when(userDao.findByUid("uid-1")).thenReturn(Optional.of(user));
        Subscription subscription = new Subscription();
        subscription.setPlanCode("PRO");
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(1000L);
        subscription.setExpiresAt(3000L);
        subscription.setEntitlements(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS));
        when(subscriptionDao.findByUserId("uid-1")).thenReturn(Optional.of(subscription));
        CurrentUserService service = new CurrentUserService(userDao, new SubscriptionService(
                subscriptionDao, Clock.fixed(Instant.ofEpochMilli(2000L), ZoneOffset.UTC)));

        var response = service.getProfile("uid-1");

        var summary = (SubscriptionService.SubscriptionSummary) response.get("subscription");
        assertNotNull(summary);
        assertEquals("PRO", summary.planCode());
        assertEquals(SubscriptionStatus.ACTIVE, summary.status());
        assertEquals(1000L, summary.startsAt());
        assertEquals(3000L, summary.expiresAt());
        assertEquals(List.of(Entitlement.AI_CHAT, Entitlement.AI_ANALYSIS), summary.entitlements());
        assertTrue(summary.effective());
        assertEquals("EMPLOYEE", response.get("role"));
        assertEquals(summary, service.toResponse(user).get("subscription"));
    }

}
