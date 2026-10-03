package com.toeic.controller;

import com.toeic.config.AuthProperties;
import com.toeic.dto.CreateSessionRequest;
import com.toeic.model.User;
import com.toeic.service.CurrentUserService;
import com.toeic.service.FirebaseSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthenticationController {

    private final FirebaseSessionService firebaseSessionService;
    private final CurrentUserService currentUserService;
    private final AuthProperties authProperties;

    public AuthenticationController(
            FirebaseSessionService firebaseSessionService,
            CurrentUserService currentUserService,
            AuthProperties authProperties
    ) {
        this.firebaseSessionService = firebaseSessionService;
        this.currentUserService = currentUserService;
        this.authProperties = authProperties;
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken csrfToken) {
        return Map.of("token", csrfToken.getToken());
    }

    @PostMapping("/session")
    public ResponseEntity<Map<String, Object>> createSession(
            @Valid @RequestBody CreateSessionRequest request
    ) throws Exception {
        FirebaseSessionService.SessionIdentity session = firebaseSessionService.createSession(
                request.idToken()
        );
        User user = currentUserService.requireUser(session.identity());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(session.cookie()).toString())
                .body(currentUserService.toResponse(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() {
        ResponseCookie expiredCookie = ResponseCookie
                .from(authProperties.getCookieName(), "")
                .httpOnly(true)
                .secure(authProperties.isCookieSecure())
                .sameSite(authProperties.getCookieSameSite())
                .path("/")
                .maxAge(0)
                .build();
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredCookie.toString())
                .build();
    }

    private ResponseCookie sessionCookie(String value) {
        return ResponseCookie.from(authProperties.getCookieName(), value)
                .httpOnly(true)
                .secure(authProperties.isCookieSecure())
                .sameSite(authProperties.getCookieSameSite())
                .path("/")
                .maxAge(authProperties.getSessionDuration())
                .build();
    }
}
