package com.toeic.controller;

import com.toeic.config.AuthProperties;
import com.toeic.config.SecurityConfig;
import com.toeic.model.FirebaseIdentity;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.security.FirebaseAuthenticationFilter;
import com.toeic.security.RestAccessDeniedHandler;
import com.toeic.security.RestAuthenticationEntryPoint;
import com.toeic.service.CurrentUserService;
import com.toeic.service.FirebaseSessionService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.ServletWebSecurityAutoConfiguration;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthenticationController.class)
@TestPropertySource(properties = "app.auth.cookie-secure=true")
@ImportAutoConfiguration({
        SecurityAutoConfiguration.class,
        SecurityFilterAutoConfiguration.class,
        ServletWebSecurityAutoConfiguration.class
})
@Import({
        SecurityConfig.class,
        FirebaseAuthenticationFilter.class,
        RestAuthenticationEntryPoint.class,
        RestAccessDeniedHandler.class,
        ApiExceptionHandler.class,
        AuthenticationControllerTests.AuthTestConfiguration.class
})
class AuthenticationControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FirebaseSessionService firebaseSessionService;

    @MockitoBean
    private CurrentUserService currentUserService;

    @Test
    void csrfEndpointReturnsATokenAndInitializesTheCsrfCookie() throws Exception {
        mockMvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("XSRF-TOKEN=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/")))
                .andExpect(result -> assertEquals(
                        "Lax",
                        result.getResponse().getCookie("XSRF-TOKEN").getAttribute("SameSite")
                ));
    }

    @Test
    void csrfEndpointCanRecoverWhenTheExistingSessionCookieIsInvalid() throws Exception {
        when(firebaseSessionService.verifySession("stale-session")).thenThrow(
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "FIREBASE_SESSION_INVALID")
        );

        mockMvc.perform(get("/api/v1/auth/csrf")
                        .cookie(new Cookie("session", "stale-session")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void createsAHostOnlySecureSevenDayHttpOnlySessionCookie() throws Exception {
        FirebaseIdentity identity = new FirebaseIdentity(
                "uid-1",
                "user@example.com",
                "User",
                null,
                "ADMIN"
        );
        User user = new User();
        user.setUid("uid-1");
        user.setEmail("user@example.com");
        user.setDisplayName("User");
        user.setRole(UserRole.USER);
        when(firebaseSessionService.createSession("fresh-id-token")).thenReturn(
                new FirebaseSessionService.SessionIdentity("session-value", identity)
        );
        when(currentUserService.requireUser(identity)).thenReturn(user);
        when(currentUserService.toResponse(user)).thenReturn(Map.of(
                "uid", "uid-1",
                "email", "user@example.com",
                "role", "USER"
        ));

        mockMvc.perform(post("/api/v1/auth/session")
                        .with(csrf())
                        .cookie(new Cookie("session", "stale-session"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"idToken":"fresh-id-token"}
                                """))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("session=session-value")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=604800")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, not(containsString("Domain="))))
                .andExpect(jsonPath("$.uid").value("uid-1"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.session").doesNotExist())
                .andExpect(jsonPath("$.idToken").doesNotExist());
    }

    @Test
    void rejectsSessionCreationWithoutCsrf() throws Exception {
        mockMvc.perform(post("/api/v1/auth/session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"idToken":"fresh-id-token"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_TOKEN_INVALID"));
    }

    @Test
    void logoutExpiresTheSameSessionCookie() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                        .with(csrf())
                        .cookie(new Cookie("session", "stale-session")))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("session=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Secure")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Path=/")));
    }

    @Test
    void localHttpConfigurationOmitsTheSecureCookieAttribute() {
        AuthenticationController controller = new AuthenticationController(
                mock(FirebaseSessionService.class),
                mock(CurrentUserService.class),
                new AuthProperties("session", Duration.ofDays(7), false, "Lax")
        );

        String cookie = controller.logout().getHeaders().getFirst(HttpHeaders.SET_COOKIE);

        assertNotNull(cookie);
        assertFalse(cookie.contains("Secure"));
    }

    @TestConfiguration
    static class AuthTestConfiguration {

        @Bean
        AuthProperties authProperties() {
            return new AuthProperties("session", Duration.ofDays(7), true, "Lax");
        }
    }
}
