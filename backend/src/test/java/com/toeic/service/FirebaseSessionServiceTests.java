package com.toeic.service;

import com.google.firebase.auth.FirebaseAuthException;
import com.toeic.config.AuthProperties;
import com.toeic.model.FirebaseIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FirebaseSessionServiceTests {

    @Test
    void createsASevenDaySessionFromARecentlyAuthenticatedIdToken() throws Exception {
        FirebaseAuthGateway firebaseAuth = mock(FirebaseAuthGateway.class);
        FirebaseAuthGateway.VerifiedIdToken token = tokenWithAuthTime(
                Instant.now().getEpochSecond()
        );
        when(firebaseAuth.verifyIdToken("fresh-id-token", true)).thenReturn(token);
        when(firebaseAuth.createSessionCookie("fresh-id-token", Duration.ofDays(7)))
                .thenReturn("session-cookie");

        FirebaseSessionService service = new FirebaseSessionService(firebaseAuth, properties());
        FirebaseSessionService.SessionIdentity result = service.createSession("fresh-id-token");

        assertEquals("session-cookie", result.cookie());
        assertEquals("uid-1", result.identity().uid());
        assertEquals("user@example.com", result.identity().email());
        assertEquals("User", result.identity().displayName());
        assertEquals("https://example.com/avatar.png", result.identity().photoUrl());
        verify(firebaseAuth).createSessionCookie(eq("fresh-id-token"), eq(Duration.ofDays(7)));
    }

    @Test
    void rejectsAnIdTokenWhoseAuthenticationIsOlderThanFiveMinutes() throws Exception {
        FirebaseAuthGateway firebaseAuth = mock(FirebaseAuthGateway.class);
        FirebaseAuthGateway.VerifiedIdToken token = tokenWithAuthTime(
                Instant.now().minusSeconds(301).getEpochSecond()
        );
        when(firebaseAuth.verifyIdToken("stale-id-token", true)).thenReturn(token);

        FirebaseSessionService service = new FirebaseSessionService(firebaseAuth, properties());
        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.createSession("stale-id-token")
        );

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        assertEquals("FIREBASE_RECENT_LOGIN_REQUIRED", error.getReason());
    }

    @Test
    void verifiesARevocationCheckedSessionCookie() throws Exception {
        FirebaseAuthGateway firebaseAuth = mock(FirebaseAuthGateway.class);
        FirebaseIdentity identity = new FirebaseIdentity(
                "uid-1",
                "user@example.com",
                "User",
                "https://example.com/avatar.png",
                "ADMIN"
        );
        when(firebaseAuth.verifySessionCookie("session-cookie", true)).thenReturn(identity);

        FirebaseSessionService service = new FirebaseSessionService(firebaseAuth, properties());
        var verifiedIdentity = service.verifySession("session-cookie");

        assertEquals("uid-1", verifiedIdentity.uid());
        verify(firebaseAuth).verifySessionCookie("session-cookie", true);
    }

    @Test
    void convertsInvalidSessionCookiesToUnauthorizedWithoutLeakingTheCookie() throws Exception {
        FirebaseAuthGateway firebaseAuth = mock(FirebaseAuthGateway.class);
        FirebaseAuthException firebaseError = mock(FirebaseAuthException.class);
        when(firebaseAuth.verifySessionCookie("secret-cookie", true)).thenThrow(firebaseError);

        FirebaseSessionService service = new FirebaseSessionService(firebaseAuth, properties());
        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.verifySession("secret-cookie")
        );

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        assertEquals("FIREBASE_SESSION_INVALID", error.getReason());
        assertTrue(error.getMessage() == null || !error.getMessage().contains("secret-cookie"));
    }

    private FirebaseAuthGateway.VerifiedIdToken tokenWithAuthTime(long authTime) {
        return new FirebaseAuthGateway.VerifiedIdToken(
                new FirebaseIdentity(
                        "uid-1",
                        "user@example.com",
                        "User",
                        "https://example.com/avatar.png",
                        "ADMIN"
                ),
                authTime
        );
    }

    private AuthProperties properties() {
        return new AuthProperties("session", Duration.ofDays(7), true, "Lax");
    }
}
