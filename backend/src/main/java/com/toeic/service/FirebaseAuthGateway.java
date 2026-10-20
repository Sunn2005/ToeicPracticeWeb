package com.toeic.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.SessionCookieOptions;
import com.toeic.model.FirebaseIdentity;
import org.springframework.stereotype.Component;

import java.time.Duration;

public interface FirebaseAuthGateway {

    VerifiedIdToken verifyIdToken(String idToken, boolean checkRevoked) throws FirebaseAuthException;

    String createSessionCookie(String idToken, Duration duration) throws FirebaseAuthException;

    FirebaseIdentity verifySessionCookie(String sessionCookie, boolean checkRevoked)
            throws FirebaseAuthException;

    record VerifiedIdToken(FirebaseIdentity identity, Long authenticatedAtEpochSeconds) {
    }

    @Component
    class AdminFirebaseAuthGateway implements FirebaseAuthGateway {

        private final FirebaseAuth firebaseAuth;

        public AdminFirebaseAuthGateway(FirebaseAuth firebaseAuth) {
            this.firebaseAuth = firebaseAuth;
        }

        @Override
        public VerifiedIdToken verifyIdToken(String idToken, boolean checkRevoked)
                throws FirebaseAuthException {
            FirebaseToken token = firebaseAuth.verifyIdToken(idToken, checkRevoked);
            Object authTime = token.getClaims().get("auth_time");
            Long authenticatedAt = authTime instanceof Number number
                    ? number.longValue()
                    : null;
            return new VerifiedIdToken(toIdentity(token), authenticatedAt);
        }

        @Override
        public String createSessionCookie(String idToken, Duration duration)
                throws FirebaseAuthException {
            SessionCookieOptions options = SessionCookieOptions.builder()
                    .setExpiresIn(duration.toMillis())
                    .build();
            return firebaseAuth.createSessionCookie(idToken, options);
        }

        @Override
        public FirebaseIdentity verifySessionCookie(String sessionCookie, boolean checkRevoked)
                throws FirebaseAuthException {
            return toIdentity(firebaseAuth.verifySessionCookie(sessionCookie, checkRevoked));
        }

        private FirebaseIdentity toIdentity(FirebaseToken token) {
            Object role = token.getClaims().get("role");
            return new FirebaseIdentity(
                    token.getUid(),
                    token.getEmail(),
                    token.getName(),
                    token.getPicture(),
                    role == null ? null : String.valueOf(role)
            );
        }
    }
}
