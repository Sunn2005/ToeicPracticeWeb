package com.toeic.security;

import com.toeic.config.SecurityConfig;
import com.toeic.controller.ApiExceptionHandler;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.service.CurrentUserService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.when;

@WebMvcTest(SecurityAuthorizationTests.SecurityProbeController.class)
@ImportAutoConfiguration({
        SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class,
        ServletWebSecurityAutoConfiguration.class
})
@Import({
        SecurityAuthorizationTests.SecurityProbeController.class,
        ApiExceptionHandler.class,
        SecurityConfig.class,
        FirebaseAuthenticationFilter.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class
})
class SecurityAuthorizationTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CurrentUserService currentUserService;

    @Test
    void productionDomainCanCompleteCorsPreflight() throws Exception {
        mockMvc.perform(options("/api/users/me/statistics")
                        .header(HttpHeaders.ORIGIN, "https://capytoeic.id.vn")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "https://capytoeic.id.vn"
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
    void creatingAnAttemptRequiresAuthenticationEvenThoughTestReadsArePublic() throws Exception {
        mockMvc.perform(post("/api/tests/test-1/attempts"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/tests/test-1/attempts")
                        .with(authentication(authenticationFor(UserRole.USER))))
                .andExpect(status().isOk());
    }

    @Test
    void validFirebaseBearerTokenAuthenticatesTheRequest() throws Exception {
        User user = new User();
        user.setUid("user-1");
        user.setRole(UserRole.USER);
        when(currentUserService.requireUser("Bearer valid-token")).thenReturn(user);

        mockMvc.perform(get("/api/users/me/statistics")
                        .header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk());
    }

    @Test
    void invalidFirebaseBearerTokenReturnsUnauthorized() throws Exception {
        when(currentUserService.requireUser("Bearer invalid-token")).thenThrow(
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token không hợp lệ")
        );

        mockMvc.perform(get("/api/tests")
                        .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void authenticatedBusinessErrorsAreNotConvertedToUnauthorized() throws Exception {
        User user = new User();
        user.setUid("user-1");
        user.setRole(UserRole.USER);
        when(currentUserService.requireUser("Bearer valid-token")).thenReturn(user);

        mockMvc.perform(get("/api/attempts/conflict")
                        .header("Authorization", "Bearer valid-token"))
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
