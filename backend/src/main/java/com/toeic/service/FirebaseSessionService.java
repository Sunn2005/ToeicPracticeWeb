package com.toeic.service;

import com.google.firebase.ErrorCode;
import com.google.firebase.auth.AuthErrorCode;
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
        } catch (FirebaseAuthException exception) {
            log.warn("Firebase ID token verification or session creation failed");
            throw firebaseFailure(exception, "FIREBASE_ID_TOKEN_INVALID");
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "FIREBASE_ID_TOKEN_INVALID", exception
            );
        }
    }

    public FirebaseIdentity verifySession(String sessionCookie) {
        if (sessionCookie == null || sessionCookie.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "FIREBASE_SESSION_INVALID");
        }

        try {
            return firebaseAuth.verifySessionCookie(sessionCookie, true);
        } catch (FirebaseAuthException exception) {
            log.warn("Firebase session cookie verification failed");
            throw firebaseFailure(exception, "FIREBASE_SESSION_INVALID");
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "FIREBASE_SESSION_INVALID", exception
            );
        }
    }

    private ResponseStatusException firebaseFailure(
            FirebaseAuthException exception,
            String invalidCredentialCode
    ) {
        if (isInfrastructureFailure(exception)) {
            return new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "FIREBASE_AUTH_UNAVAILABLE",
                    exception
            );
        }
        return new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                invalidCredentialCode,
                exception
        );
    }

    private boolean isInfrastructureFailure(FirebaseAuthException exception) {
        AuthErrorCode authErrorCode = exception.getAuthErrorCode();
        if (authErrorCode == AuthErrorCode.CERTIFICATE_FETCH_FAILED
                || authErrorCode == AuthErrorCode.CONFIGURATION_NOT_FOUND) {
            return true;
        }

        ErrorCode errorCode = exception.getErrorCode();
        if (errorCode == null) {
            return authErrorCode == null;
        }
        return switch (errorCode) {
            case CANCELLED, DATA_LOSS, DEADLINE_EXCEEDED, INTERNAL,
                    RESOURCE_EXHAUSTED, UNAVAILABLE, UNKNOWN -> true;
            default -> false;
        };
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
