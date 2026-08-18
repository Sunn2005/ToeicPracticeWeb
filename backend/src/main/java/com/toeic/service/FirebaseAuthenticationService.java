package com.toeic.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.toeic.model.FirebaseIdentity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FirebaseAuthenticationService {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthenticationService.class);

    private final FirebaseAuth firebaseAuth;

    public FirebaseAuthenticationService(FirebaseAuth firebaseAuth) {
        this.firebaseAuth = firebaseAuth;
    }

    public String requireUid(String authorization) {
        return requireIdentity(authorization).uid();
    }

    public FirebaseIdentity requireIdentity(String authorization) {
        String idToken = extractBearerToken(authorization);

        try {
            FirebaseToken decodedToken = firebaseAuth.verifyIdToken(idToken);
            return new FirebaseIdentity(
                    decodedToken.getUid(),
                    claim(decodedToken, "email"),
                    claim(decodedToken, "name"),
                    claim(decodedToken, "picture"),
                    claim(decodedToken, "role")
            );
        } catch (FirebaseAuthException | IllegalArgumentException exception) {
            log.warn("Firebase ID token verification failed: {}", exception.getMessage());
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Firebase ID token không hợp lệ hoặc đã hết hạn",
                    exception
            );
        }
    }

    private String claim(FirebaseToken token, String name) {
        Object value = token.getClaims().get(name);
        return value == null ? null : String.valueOf(value);
    }

    private String extractBearerToken(String authorization) {
        if (authorization == null || authorization.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu Authorization header");
        }

        String[] parts = authorization.trim().split("\\s+", 2);
        if (parts.length != 2
                || !"Bearer".equalsIgnoreCase(parts[0])
                || parts[1].isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authorization header phải có dạng Bearer <Firebase ID token>"
            );
        }

        return parts[1];
    }
}
