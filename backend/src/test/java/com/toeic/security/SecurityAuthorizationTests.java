package com.toeic.security;

import com.toeic.config.SecurityConfig;
import com.toeic.controller.ApiExceptionHandler;
import com.toeic.controller.PaymentController;
import com.toeic.controller.AdminPaymentController;
import com.toeic.service.AdminPaymentService;
import com.toeic.service.AdminRevenueService;
import com.toeic.config.AuthProperties;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.service.CurrentUserService;
import com.toeic.service.FirebaseSessionService;
import com.toeic.service.PaymentService;
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
        com.toeic.controller.StaffManagementController.class,
        com.toeic.controller.StaffPasswordController.class,
        com.toeic.controller.EmployeeTestController.class,
        com.toeic.controller.AdminReviewController.class,
        PaymentController.class,
        AdminPaymentController.class
})
@ImportAutoConfiguration({
        SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class,
        ServletWebSecurityAutoConfiguration.class
})
@Import({
        SecurityAuthorizationTests.SecurityProbeController.class,
        com.toeic.controller.StaffManagementController.class,
        com.toeic.controller.StaffPasswordController.class,
        com.toeic.controller.EmployeeTestController.class,
        com.toeic.controller.AdminReviewController.class,
        PaymentController.class,
        AdminPaymentController.class,
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
    private com.toeic.service.StaffAccessService staffAccessService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @MockitoBean
    private FirebaseSessionService firebaseSessionService;

    @MockitoBean
    private PaymentService paymentService;

    @MockitoBean private com.toeic.service.StaffRecoveryLimiter staffRecoveryLimiter;
    @MockitoBean(name = "staffRecoveryExecutor") private org.springframework.core.task.TaskExecutor staffRecoveryExecutor;
    @MockitoBean private com.toeic.service.StaffCredentialService staffCredentialService;
    @MockitoBean private com.toeic.service.StaffManagementService staffManagementService;
    @MockitoBean private com.toeic.service.EmployeeTestService employeeTestService;
    @MockitoBean private com.toeic.service.MediaStorageService mediaStorageService;
    @MockitoBean private com.toeic.service.AdminReviewService adminReviewService;
    @MockitoBean private AdminPaymentService adminPaymentService;
    @MockitoBean private AdminRevenueService adminRevenueService;

    @Test
    void reconciliationRequiresAdminAuthenticationAndCsrf() throws Exception {
        String path = "/api/admin/payments/orders/123/reconcile";
        mockMvc.perform(post(path).with(csrf())).andExpect(status().isUnauthorized());
        for (var role : List.of(UserRole.USER, UserRole.EMPLOYEE)) {
            mockMvc.perform(post(path).with(csrf()).with(authentication(authenticationFor(role))))
                    .andExpect(status().isForbidden());
        }
        mockMvc.perform(post(path).with(authentication(authenticationFor(UserRole.ADMIN))))
                .andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(paymentService);
        mockMvc.perform(post(path).with(csrf()).with(authentication(authenticationFor(UserRole.ADMIN))))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(paymentService).reconcile(123);
    }

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
    void employeeNeedsTestPermissionsAndCannotUseUnrelatedAdminApis() throws Exception {
        mockMvc.perform(get("/api/employee/tests").with(authentication(authenticationFor(UserRole.EMPLOYEE))))
                .andExpect(status().isForbidden());
        var viewer = new ToeicAuthenticationToken(authenticationFor(UserRole.EMPLOYEE).getPrincipal(), List.of(
                new SimpleGrantedAuthority("ROLE_EMPLOYEE"), new SimpleGrantedAuthority("tests.view")));
        mockMvc.perform(get("/api/employee/tests")
                        .with(authentication(viewer)))
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
    void grantedEmployeesCanReadRevenueButCannotManageStaffOrReconcile() throws Exception {
        var employee = new ToeicAuthenticationToken(authenticationFor(UserRole.EMPLOYEE).getPrincipal(), List.of(
                new SimpleGrantedAuthority("ROLE_EMPLOYEE"), new SimpleGrantedAuthority("revenue.view"),
                new SimpleGrantedAuthority("orders.view")));
        mockMvc.perform(get("/api/admin/payments/revenue").with(authentication(employee))).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/payments/orders").with(authentication(employee))).andExpect(status().isOk());
        mockMvc.perform(get("/api/admin/staff").with(authentication(employee))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/test-submissions").with(authentication(employee))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/payments/orders/123/reconcile").with(csrf()).with(authentication(employee))).andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(paymentService);
    }


    @Test
    void currentGroupPermissionsAreAppliedOnEverySessionRequestAndBlockingKeepsLearningAvailable() throws Exception {
        var identity = new FirebaseIdentity("employee-1", "employee@example.test", "Staff", null, null);
        var user = new User(); user.setUid("employee-1"); user.setRole(UserRole.EMPLOYEE);
        when(firebaseSessionService.verifySession("staff-session")).thenReturn(identity);
        when(currentUserService.requireUser(identity)).thenReturn(user);
        when(staffAccessService.forUser(user)).thenReturn(new com.toeic.service.StaffAccessService.Access(true, "accountants", List.of("revenue.view")));
        mockMvc.perform(get("/api/admin/payments/revenue").cookie(new Cookie("session", "staff-session"))).andExpect(status().isOk());
        when(staffAccessService.forUser(user)).thenReturn(new com.toeic.service.StaffAccessService.Access(false, "accountants", List.of()));
        mockMvc.perform(get("/api/admin/payments/revenue").cookie(new Cookie("session", "staff-session"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/employee/tests").cookie(new Cookie("session", "staff-session"))).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/users/me/statistics").cookie(new Cookie("session", "staff-session"))).andExpect(status().isOk());
    }

    @Test
    void testViewerCannotCreateEditDeleteSubmitOrUpload() throws Exception {
        var viewer = new ToeicAuthenticationToken(authenticationFor(UserRole.EMPLOYEE).getPrincipal(), List.of(
                new SimpleGrantedAuthority("ROLE_EMPLOYEE"), new SimpleGrantedAuthority("tests.view")));
        for (var mutation : List.of(post("/api/employee/tests"), put("/api/employee/tests/test"),
                delete("/api/employee/tests/test"), post("/api/employee/tests/test/submit"))) {
            mockMvc.perform(mutation.with(csrf()).with(authentication(viewer))
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isForbidden());
        }
        var upload = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/employee/media")
                .file("file", new byte[]{1});
        mockMvc.perform(upload.with(csrf()).with(authentication(viewer))).andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(employeeTestService, mediaStorageService);
    }

    @Test
    void staffMutationsAreAdminOnlyAndCsrfProtected() throws Exception {
        String path = "/api/admin/staff/groups";
        String json = "{\"name\":\"Finance\",\"code\":\"FINANCE\",\"permissions\":[\"revenue.view\"]}";
        mockMvc.perform(post(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(path).with(csrf()).with(authentication(authenticationFor(UserRole.EMPLOYEE)))
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isForbidden());
        mockMvc.perform(post(path).with(authentication(authenticationFor(UserRole.ADMIN)))
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(staffManagementService);
        mockMvc.perform(post(path).with(csrf()).with(authentication(authenticationFor(UserRole.ADMIN)))
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isCreated());
        org.mockito.Mockito.verify(staffManagementService).saveGroup(org.mockito.ArgumentMatchers.eq("admin-1"), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void removedSubscriptionManagementEndpointsAreUnavailableEvenToAdmins() throws Exception {
        for (var request : List.of(get("/api/admin/subscriptions/target-user"),
                put("/api/admin/subscriptions/target-user").contentType(MediaType.APPLICATION_JSON).content("{\"expiresAt\":1800000050000}"),
                delete("/api/admin/subscriptions/target-user"))) {
            mockMvc.perform(request.with(csrf()).with(authentication(authenticationFor(UserRole.ADMIN))))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void temporaryPasswordCannotBypassChangeWithDirectApiCalls() throws Exception {
        var identity = new FirebaseIdentity("employee-1", "staff@example.test", "Staff", null, null);
        var user = new User(); user.setUid("employee-1"); user.setRole(UserRole.EMPLOYEE); user.setPasswordChangeRequired(true);
        when(firebaseSessionService.verifySession("temporary")).thenReturn(identity);
        when(currentUserService.requireUser(identity)).thenReturn(user);
        when(staffAccessService.forUser(user)).thenReturn(new com.toeic.service.StaffAccessService.Access(true, "creators", List.of("tests.view")));
        mockMvc.perform(get("/api/employee/tests").cookie(new Cookie("session", "temporary")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("STAFF_PASSWORD_CHANGE_REQUIRED"));
        mockMvc.perform(get("/api/users/me/statistics").cookie(new Cookie("session", "temporary"))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/console/account/password").cookie(new Cookie("session", "temporary")).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content("{\"oldPassword\":\"temporary\",\"newPassword\":\"NewPassword123!\"}"))
                .andExpect(status().isNoContent());
        org.mockito.Mockito.verify(staffCredentialService).change("employee-1", "temporary", "NewPassword123!");
    }

    @Test
    void revokedCredentialEpochRejectsOldAndSameSecondSessions() throws Exception {
        var user = new User(); user.setUid("employee-1"); user.setRole(UserRole.EMPLOYEE); user.setCredentialsChangedAt(1_800_000_000_999L);
        var old = new FirebaseIdentity("employee-1", "staff@example.test", "Staff", null, null, 1_800_000_000L);
        when(firebaseSessionService.verifySession("old-epoch")).thenReturn(old); when(currentUserService.requireUser(old)).thenReturn(user);
        mockMvc.perform(get("/api/users/me/statistics").cookie(new Cookie("session", "old-epoch"))).andExpect(status().isUnauthorized());
        var fresh = new FirebaseIdentity("employee-1", "staff@example.test", "Staff", null, null, 1_800_000_001L);
        when(firebaseSessionService.verifySession("fresh-epoch")).thenReturn(fresh); when(currentUserService.requireUser(fresh)).thenReturn(user);
        when(staffAccessService.forUser(user)).thenReturn(new com.toeic.service.StaffAccessService.Access(true, "creators", List.of()));
        mockMvc.perform(get("/api/users/me/statistics").cookie(new Cookie("session", "fresh-epoch"))).andExpect(status().isOk());
    }

    @Test
    void passwordRecoveryIsPublicCsrfProtectedAndHasGenericResponseEvenWithRevokedCookie() throws Exception {
        String path = "/api/v1/auth/staff/forgot-password";
        mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"unknown@example.test\"}"))
                .andExpect(status().isForbidden());
        for (String email : List.of("known@example.test", "unknown@example.test")) {
            mockMvc.perform(post(path).cookie(new Cookie("session", "revoked")).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"" + email + "\"}"))
                    .andExpect(status().isAccepted()).andExpect(jsonPath("$.code").value("STAFF_RESET_REQUESTED"));
        }
        org.mockito.Mockito.verifyNoInteractions(firebaseSessionService);
    }

    @Test
    void passwordChangeRequiresInternalRoleAndCsrfAndResendIsAdminOnly() throws Exception {
        String path = "/api/console/account/password", body = "{\"oldPassword\":\"old\",\"newPassword\":\"NewPassword123!\"}";
        mockMvc.perform(post(path).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
        org.mockito.Mockito.doThrow(new com.toeic.controller.ApiCodeException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "Not a staff password owner"))
                .when(staffCredentialService).change("user-1", "old", "NewPassword123!");
        mockMvc.perform(post(path).with(csrf()).with(authentication(authenticationFor(UserRole.USER))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mockMvc.perform(post(path).with(authentication(authenticationFor(UserRole.EMPLOYEE))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        for (var role : List.of(UserRole.ADMIN, UserRole.EMPLOYEE)) {
            mockMvc.perform(post(path).with(csrf()).with(authentication(authenticationFor(role))).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNoContent());
        }
        mockMvc.perform(post("/api/admin/staff/members/target/credentials/resend").with(csrf()).with(authentication(authenticationFor(UserRole.EMPLOYEE)))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/staff/members/target/credentials/resend").with(csrf()).with(authentication(authenticationFor(UserRole.ADMIN)))).andExpect(status().isOk());
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

        @GetMapping("/api/attempts/conflict")
        Map<String, Object> conflict() {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Sai trạng thái");
        }
    }
}
