package com.toeic.controller;

import com.toeic.dao.SubscriptionDao;
import com.toeic.model.Subscription;
import com.toeic.model.enums.UserRole;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.SubscriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.bind.support.WebDataBinderFactory;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminSubscriptionControllerTests {
    private static final long NOW = 1_800_000_000_000L;
    private MockMvc mockMvc;
    private SubscriptionDao subscriptionDao;
    private Subscription stored;

    @BeforeEach
    void setUp() throws Exception {
        subscriptionDao = mock(SubscriptionDao.class);
        when(subscriptionDao.findByUserId("target-user")).thenAnswer(ignored -> Optional.ofNullable(stored));
        doAnswer(invocation -> {
            stored = invocation.getArgument(0);
            return null;
        }).when(subscriptionDao).save(any(Subscription.class));
        SubscriptionService service = new SubscriptionService(subscriptionDao,
                Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));
        ToeicUserPrincipal principal = new ToeicUserPrincipal(
                "verified-admin", "admin@example.com", "Admin", null, UserRole.ADMIN, 1L, 1L);
        mockMvc = MockMvcBuilders.standaloneSetup(new AdminSubscriptionController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    @Override
                    public boolean supportsParameter(MethodParameter parameter) {
                        return parameter.getParameterType() == ToeicUserPrincipal.class;
                    }

                    @Override
                    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                                  NativeWebRequest request, WebDataBinderFactory factory) {
                        return principal;
                    }
                }).build();
    }

    @Test
    void getReturnsTheTargetSubscriptionSummary() throws Exception {
        stored = new Subscription();
        stored.setUserId("target-user");
        stored.setPlanCode("PRO");
        stored.setStatus(com.toeic.model.enums.SubscriptionStatus.ACTIVE);
        stored.setStartsAt(NOW - 1);
        stored.setExpiresAt(NOW + 50_000);

        mockMvc.perform(get("/api/admin/subscriptions/target-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.planCode").value("PRO"))
                .andExpect(jsonPath("$.expiresAt").value(NOW + 50_000))
                .andExpect(jsonPath("$.effective").value(true));
    }

    @Test
    void putUsesExactExpiryAndVerifiedAdminForTheTargetIgnoringServerManagedFields() throws Exception {
        mockMvc.perform(put("/api/admin/subscriptions/target-user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"expiresAt":1800000050000,"activatedBy":"forged-admin",
                                 "status":"REVOKED","entitlements":[],"userId":"forged-user"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresAt").value(1_800_000_050_000L))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.entitlements[0]").value("AI_CHAT"))
                .andExpect(jsonPath("$.effective").value(true));
        assertEquals("target-user", stored.getUserId());
        assertEquals("verified-admin", stored.getActivatedBy());
    }

    @Test
    void deleteRevokesTheTargetUsingTheVerifiedAdmin() throws Exception {
        stored = new Subscription();
        stored.setUserId("target-user");
        stored.setStatus(com.toeic.model.enums.SubscriptionStatus.ACTIVE);
        stored.setStartsAt(NOW - 1);
        stored.setExpiresAt(NOW + 50_000);

        mockMvc.perform(delete("/api/admin/subscriptions/target-user"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVOKED"))
                .andExpect(jsonPath("$.effective").value(false));
        assertEquals("verified-admin", stored.getRevokedBy());
        assertEquals(NOW, stored.getRevokedAt());
    }

    @Test
    void pastExpiryReturnsTheStableBusinessErrorWithoutPersisting() throws Exception {
        mockMvc.perform(put("/api/admin/subscriptions/target-user")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiresAt\":1799999999999}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SUBSCRIPTION_EXPIRY_INVALID"));
        verifyNoInteractions(subscriptionDao);
    }

    @Test
    void missingExpiryIsRejectedWithoutPersisting() throws Exception {
        mockMvc.perform(put("/api/admin/subscriptions/target-user")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(subscriptionDao);
    }
}
