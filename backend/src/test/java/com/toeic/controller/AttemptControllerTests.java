package com.toeic.controller;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import com.toeic.dto.CreateAttemptRequest;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AttemptControllerTests {

    private FirebaseAuth firebaseAuth;
    private Firestore firestore;
    private AttemptController controller;

    @BeforeEach
    void setUp() {
        firebaseAuth = mock(FirebaseAuth.class);
        firestore = mock(Firestore.class);
        controller = new AttemptController(firebaseAuth, firestore);
    }

    @Test
    void returnsUnauthorizedWhenAuthorizationHeaderIsMissing() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createAttempt(new CreateAttemptRequest("test_001"), null)
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verifyNoInteractions(firebaseAuth, firestore);
    }

    @Test
    void returnsUnauthorizedWhenBearerTokenIsInvalid() throws Exception {
        when(firebaseAuth.verifyIdToken("invalid-token"))
                .thenThrow(new IllegalArgumentException("invalid token"));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createAttempt(
                        new CreateAttemptRequest("test_001"),
                        "Bearer invalid-token"
                )
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verifyNoInteractions(firestore);
    }

    @Test
    void createsAttemptWithUidFromVerifiedFirebaseToken() throws Exception {
        FirebaseToken decodedToken = mock(FirebaseToken.class);
        CollectionReference attempts = mock(CollectionReference.class);
        DocumentReference document = mock(DocumentReference.class);

        when(firebaseAuth.verifyIdToken("firebase-id-token")).thenReturn(decodedToken);
        when(decodedToken.getUid()).thenReturn("firebase-uid-123");
        when(firestore.collection("attempts")).thenReturn(attempts);
        when(attempts.document()).thenReturn(document);
        when(document.getId()).thenReturn("attempt-123");
        when(document.set(any(Attempt.class))).thenReturn(ApiFutures.immediateFuture(null));

        Attempt result = controller.createAttempt(
                new CreateAttemptRequest("test_001"),
                "Bearer firebase-id-token"
        );

        assertEquals("attempt-123", result.getId());
        assertEquals("firebase-uid-123", result.getUserId());
        assertEquals("test_001", result.getTestId());
        assertEquals("IN_PROGRESS", result.getStatus());
        verify(document).set(result);
    }
}
