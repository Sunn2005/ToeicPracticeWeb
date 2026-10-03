package com.toeic.service;

import com.google.firebase.auth.FirebaseAuthException;
import com.toeic.config.AuthProperties;
import com.toeic.model.FirebaseIdentity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@Service
public class FirebaseSessionService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseSessionService.class);
    private static final long MAX_AUTH_AGE_SECONDS = 5 * 60;

    private final FirebaseAuthGateway firebaseAuth;
    private final AuthProperties authProperties;

    public FirebaseSessionService(FirebaseAuthGateway firebaseAuth, AuthProperties authProperties) {
        this.firebaseAuth = firebaseAuth;
        this.authProperties = authProperties;
    }

    public SessionIdentity createSession(String idToken) {
        if (idToken == null || idToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "FIREBASE_ID_TOKEN_INVALID");
        }

        try {
            FirebaseAuthGateway.VerifiedIdToken decodedToken = firebaseAuth.verifyIdToken(
                    idToken,
                    true
            );
            requireRecentAuthentication(decodedToken);
            String cookie = firebaseAuth.createSessionCookie(
                    idToken,
                    authProperties.getSessionDuration()
            );
            return new SessionIdentity(cookie, decodedToken.identity());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (FirebaseAuthException | IllegalArgumentException exception) {
            log.warn("Firebase ID token verification or session creation failed: {}", exception.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "FIREBASE_ID_TOKEN_INVALID",
                    exception
            );
        }
    }

    public FirebaseIdentity verifySession(String sessionCookie) {
        if (sessionCookie == null || sessionCookie.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "FIREBASE_SESSION_INVALID");
        }

        try {
            return firebaseAuth.verifySessionCookie(sessionCookie, true);
        } catch (FirebaseAuthException | IllegalArgumentException exception) {
            log.warn("Firebase session cookie verification failed: {}", exception.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "FIREBASE_SESSION_INVALID",
                    exception
            );
        }
    }

    private void requireRecentAuthentication(FirebaseAuthGateway.VerifiedIdToken token) {
        Long authTime = token.authenticatedAtEpochSeconds();
        if (authTime == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "FIREBASE_RECENT_LOGIN_REQUIRED"
            );
        }

        long ageSeconds = Instant.now().getEpochSecond() - authTime;
        if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "FIREBASE_RECENT_LOGIN_REQUIRED"
            );
        }
    }

    public record SessionIdentity(String cookie, FirebaseIdentity identity) {
    }
}
