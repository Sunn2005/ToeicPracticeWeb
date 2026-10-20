package com.toeic.security;

import com.toeic.config.SecurityConfig;
import com.toeic.controller.ApiExceptionHandler;
import com.toeic.controller.AdminSubscriptionController;
import com.toeic.controller.PaymentController;
import com.toeic.config.AuthProperties;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.service.CurrentUserService;
import com.toeic.service.FirebaseSessionService;
import com.toeic.service.PaymentService;
import com.toeic.service.SubscriptionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.when;

@WebMvcTest({
        SecurityAuthorizationTests.SecurityProbeController.class,
        AdminSubscriptionController.class,
        PaymentController.class
})
@ImportAutoConfiguration({
        SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class,
        ServletWebSecurityAutoConfiguration.class
})
@Import({
        SecurityAuthorizationTests.SecurityProbeController.class,
        AdminSubscriptionController.class,
        PaymentController.class,
        ApiExceptionHandler.class,
        SecurityConfig.class,
        AuthProperties.class,
        FirebaseAuthenticationFilter.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class
})
class SecurityAuthorizationTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private FirebaseSessionService firebaseSessionService;

    @MockitoBean
    private SubscriptionService subscriptionService;

    @MockitoBean
    private PaymentService paymentService;

    @Test
    void productionDomainCanCompleteCorsPreflight() throws Exception {
        mockMvc.perform(options("/api/users/me/statistics")
                        .header(HttpHeaders.ORIGIN, "https://capytoeic.id.vn")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "X-XSRF-TOKEN"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "https://capytoeic.id.vn"
                ))
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS,
                        "true"
                ));
    }

    @Test
    void guestCanReadPublishedTests() throws Exception {
        mockMvc.perform(get("/api/tests"))
                .andExpect(status().isOk());
    }

    @Test
    void guestCanPingHealthWithoutTouchingFirestore() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void guestCannotUseAuthenticatedApis() throws Exception {
        mockMvc.perform(get("/api/users/me/statistics"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void chatApisRequireAuthenticationAndAllowAuthenticatedUsers() throws Exception {
        mockMvc.perform(get("/api/ai/chat/conversations"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));

        mockMvc.perform(get("/api/ai/chat/conversations")
                        .with(authentication(authenticationFor(UserRole.USER))))
                .andExpect(status().isOk());
    }

    @Test
    void paymentCreationRequiresAuthenticationAndCsrfButWebhookDoesNot() throws Exception {
        when(paymentService.availablePlans("user-1")).thenReturn(List.of(
                new PaymentService.PlanOption("PRO_30", 99_000L, 30, false, false)
        ));
        when(paymentService.createProPayment("user-1", "PRO_30"))
                .thenReturn(new PaymentService.CreatePaymentResult("https://payos.test/checkout/1", 1L));
        when(paymentService.handleWebhook(org.mockito.ArgumentMatchers.anyMap()))
                .thenReturn(new PaymentService.WebhookResult(true, "activated"));

        mockMvc.perform(get("/api/payments/pro/plans"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/payments/pro/plans")
                        .with(authentication(authenticationFor(UserRole.USER))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].planCode").value("PRO_30"));

        mockMvc.perform(post("/api/payments/pro")
                        .with(authentication(authenticationFor(UserRole.USER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"PRO_30\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/payments/pro")
                        .with(csrf())
                        .with(authentication(authenticationFor(UserRole.USER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"planCode\":\"PRO_30\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderCode").value(1L));

        mockMvc.perform(post("/api/payments/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"data\":{},\"signature\":\"signed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.handled").value(true));
    }

    @Test
    void creatingAnAttemptRequiresAuthenticationEvenThoughTestReadsArePublic() throws Exception {
        mockMvc.perform(post("/api/tests/test-1/attempts"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/tests/test-1/attempts").with(csrf()))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/tests/test-1/attempts")
                        .with(csrf())
                        .with(authentication(authenticationFor(UserRole.USER))))
                .andExpect(status().isOk());
    }

    @Test
    void validFirebaseSessionCookieAuthenticatesTheRequest() throws Exception {
        FirebaseIdentity identity = new FirebaseIdentity(
                "user-1", "user@example.com", "User", null, null
        );
        User user = new User();
        user.setUid("user-1");
        user.setRole(UserRole.USER);
        when(firebaseSessionService.verifySession("valid-session")).thenReturn(identity);
        when(currentUserService.requireUser(identity)).thenReturn(user);

        mockMvc.perform(get("/api/users/me/statistics")
                        .cookie(new Cookie("session", "valid-session")))
                .andExpect(status().isOk());
    }

    @Test
    void invalidFirebaseSessionCookieReturnsUnauthorized() throws Exception {
        when(firebaseSessionService.verifySession("invalid-session")).thenThrow(
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token không hợp lệ")
        );

        mockMvc.perform(get("/api/tests")
                        .cookie(new Cookie("session", "invalid-session")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void firebaseInfrastructureFailureReturnsServiceUnavailableInsteadOfLoggingTheUserOut()
            throws Exception {
        when(firebaseSessionService.verifySession("valid-session")).thenThrow(
                new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "FIREBASE_AUTH_UNAVAILABLE"
                )
        );

        mockMvc.perform(get("/api/users/me/statistics")
                        .cookie(new Cookie("session", "valid-session")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("FIREBASE_AUTH_UNAVAILABLE"));
    }

    @Test
    void authenticatedBusinessErrorsAreNotConvertedToUnauthorized() throws Exception {
        FirebaseIdentity identity = new FirebaseIdentity(
                "user-1", "user@example.com", "User", null, null
        );
        User user = new User();
        user.setUid("user-1");
        user.setRole(UserRole.USER);
        when(firebaseSessionService.verifySession("valid-session")).thenReturn(identity);
        when(currentUserService.requireUser(identity)).thenReturn(user);

        mockMvc.perform(get("/api/attempts/conflict")
                        .cookie(new Cookie("session", "valid-session")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void userCannotUseEmployeeOrAdminApis() throws Exception {
        mockMvc.perform(get("/api/employee/tests")
                        .with(authentication(authenticationFor(UserRole.USER))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        mockMvc.perform(get("/api/admin/test-submissions")
                        .with(authentication(authenticationFor(UserRole.USER))))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeeCanUseEmployeeButNotAdminApis() throws Exception {
        mockMvc.perform(get("/api/employee/tests")
                        .with(authentication(authenticationFor(UserRole.EMPLOYEE))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/test-submissions")
                        .with(authentication(authenticationFor(UserRole.EMPLOYEE))))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanUseEmployeeAndAdminApis() throws Exception {
        mockMvc.perform(get("/api/employee/tests")
                        .with(authentication(authenticationFor(UserRole.ADMIN))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/test-submissions")
                        .with(authentication(authenticationFor(UserRole.ADMIN))))
                .andExpect(status().isOk());
    }

    @Test
    void adminCanReadActivateAndRevokeSubscriptions() throws Exception {
        SubscriptionService.SubscriptionSummary summary = new SubscriptionService.SubscriptionSummary(
                "PRO", com.toeic.model.enums.SubscriptionStatus.ACTIVE, 1L, 1_800_000_050_000L,
                List.of(com.toeic.model.enums.Entitlement.AI_CHAT, com.toeic.model.enums.Entitlement.AI_ANALYSIS), true);
        when(subscriptionService.getSummary("target-user")).thenReturn(summary);
        when(subscriptionService.activateOrExtend("target-user", 1_800_000_050_000L, "admin-1"))
                .thenReturn(summary);
        when(subscriptionService.revoke("target-user", "admin-1")).thenReturn(summary);
        for (var request : List.of(get("/api/admin/subscriptions/target-user"),
                put("/api/admin/subscriptions/target-user").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiresAt\":1800000050000}"),
                delete("/api/admin/subscriptions/target-user"))) {
            mockMvc.perform(request.with(csrf()).with(authentication(authenticationFor(UserRole.ADMIN))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.planCode").value("PRO"));
        }
    }

    @Test
    void userAndEmployeeCannotReadActivateOrRevokeSubscriptions() throws Exception {
        for (UserRole role : List.of(UserRole.USER, UserRole.EMPLOYEE)) {
            for (var request : List.of(get("/api/admin/subscriptions/target-user"),
                    put("/api/admin/subscriptions/target-user").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"expiresAt\":1800000050000}"),
                    delete("/api/admin/subscriptions/target-user"))) {
                mockMvc.perform(request.with(csrf()).with(authentication(authenticationFor(role))))
                        .andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            }
        }
        org.mockito.Mockito.verifyNoInteractions(subscriptionService);
    }

    @Test
    void guestCannotReadOrMutateSubscriptions() throws Exception {
        for (var request : List.of(get("/api/admin/subscriptions/target-user"),
                put("/api/admin/subscriptions/target-user").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiresAt\":1800000050000}"),
                delete("/api/admin/subscriptions/target-user"))) {
            mockMvc.perform(request.with(csrf()))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
        }
        org.mockito.Mockito.verifyNoInteractions(subscriptionService);
    }

    private ToeicAuthenticationToken authenticationFor(UserRole role) {
        ToeicUserPrincipal principal = new ToeicUserPrincipal(
                role.name().toLowerCase() + "-1",
                role.name().toLowerCase() + "@example.com",
                role.name(),
                null,
                role,
                1L,
                1L
        );
        return new ToeicAuthenticationToken(
                principal,
                List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))
        );
    }

    @RestController
    static class SecurityProbeController {

        @GetMapping("/api/tests")
        Map<String, Object> tests() {
            return Map.of("ok", true);
        }

        @GetMapping("/api/health")
        Map<String, String> health() {
            return Map.of("status", "ok");
        }

        @GetMapping("/api/users/me/statistics")
        Map<String, Object> statistics() {
            return Map.of("ok", true);
        }

        @GetMapping("/api/ai/chat/conversations")
        Map<String, Object> chatConversations() {
            return Map.of("ok", true);
        }

        @PostMapping("/api/tests/{testId}/attempts")
        Map<String, Object> createAttempt() {
            return Map.of("ok", true);
        }

        @GetMapping("/api/employee/tests")
        Map<String, Object> employeeTests() {
            return Map.of("ok", true);
        }

        @GetMapping("/api/admin/test-submissions")
        Map<String, Object> adminSubmissions() {
            return Map.of("ok", true);
        }

        @GetMapping("/api/attempts/conflict")
        Map<String, Object> conflict() {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Sai trạng thái");
        }
    }
}
