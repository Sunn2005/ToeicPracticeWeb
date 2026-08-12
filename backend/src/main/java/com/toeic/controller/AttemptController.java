package com.toeic.controller;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.toeic.dto.CreateAttemptRequest;
import com.toeic.model.Attempt;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;

@RestController
@RequestMapping("/api/attempts")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class AttemptController {

    private static final Logger log = LoggerFactory.getLogger(AttemptController.class);

    private final FirebaseAuth firebaseAuth;
    private final Firestore firestore;

    public AttemptController(FirebaseAuth firebaseAuth, Firestore firestore) {
        this.firebaseAuth = firebaseAuth;
        this.firestore = firestore;
    }

    @PostMapping
    public Attempt createAttempt(
            @RequestBody CreateAttemptRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String idToken = extractBearerToken(authorization);

        FirebaseToken decodedToken;
        try {
            decodedToken = firebaseAuth.verifyIdToken(idToken);
        } catch (FirebaseAuthException | IllegalArgumentException exception) {
            log.warn("Firebase ID token verification failed: {}", exception.getMessage());
            throw unauthorized("Firebase ID token không hợp lệ", exception);
        }

        String userId = decodedToken.getUid();
        DocumentReference document = firestore.collection("attempts").document();

        Attempt attempt = new Attempt();
        attempt.setId(document.getId());
        attempt.setUserId(userId);
        attempt.setTestId(request.getTestId());
        attempt.setStatus("IN_PROGRESS");
        attempt.setStartedAt(System.currentTimeMillis());
        attempt.setSubmittedAt(null);
        attempt.setScore(null);
        attempt.setAnswers(new HashMap<>());

        document.set(attempt).get();
        return attempt;
    }

    private String extractBearerToken(String authorization) {
        if (authorization == null || authorization.isBlank()) {
            throw unauthorized("Thiếu Authorization header", null);
        }

        String[] parts = authorization.trim().split("\\s+", 2);
        if (parts.length != 2
                || !"Bearer".equalsIgnoreCase(parts[0])
                || parts[1].isBlank()) {
            throw unauthorized("Authorization header phải có dạng Bearer <token>", null);
        }

        return parts[1];
    }

    private ResponseStatusException unauthorized(String reason, Throwable cause) {
        return cause == null
                ? new ResponseStatusException(HttpStatus.UNAUTHORIZED, reason)
                : new ResponseStatusException(HttpStatus.UNAUTHORIZED, reason, cause);
    }
}
