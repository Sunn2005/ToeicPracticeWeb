package com.toeic.controller;

import com.toeic.dto.CreateAttemptRequest;
import com.toeic.service.AttemptService;
import com.toeic.service.FirebaseAuthenticationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AttemptControllerTests {

    private FirebaseAuthenticationService authenticationService;
    private AttemptService attemptService;
    private AttemptController controller;

    @BeforeEach
    void setUp() {
        authenticationService = mock(FirebaseAuthenticationService.class);
        attemptService = mock(AttemptService.class);
        controller = new AttemptController(authenticationService, attemptService);
    }

    @Test
    void returnsUnauthorizedWhenAuthorizationHeaderIsMissing() {
        when(authenticationService.requireUid(null)).thenThrow(
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu Authorization header")
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createAttempt(new CreateAttemptRequest("test-1"), null)
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verifyNoInteractions(attemptService);
    }

    @Test
    void returnsUnauthorizedWhenBearerTokenIsInvalid() {
        when(authenticationService.requireUid("Bearer invalid-token")).thenThrow(
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Firebase ID token không hợp lệ")
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createAttempt(
                        new CreateAttemptRequest("test-1"),
                        "Bearer invalid-token"
                )
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verifyNoInteractions(attemptService);
    }

    @Test
    void createsAttemptWithUidFromVerifiedFirebaseToken() throws Exception {
        Map<String, Object> expected = Map.of(
                "id", "attempt-123",
                "userId", "firebase-uid-123",
                "testId", "test-1",
                "status", "IN_PROGRESS"
        );
        when(authenticationService.requireUid("Bearer firebase-id-token"))
                .thenReturn("firebase-uid-123");
        when(attemptService.createOrResume(
                "firebase-uid-123", "test-1", null, null, null, null, null
        ))
                .thenReturn(expected);

        Map<String, Object> result = controller.createAttempt(
                new CreateAttemptRequest("test-1"),
                "Bearer firebase-id-token"
        );

        assertEquals(expected, result);
        verify(attemptService).createOrResume(
                "firebase-uid-123", "test-1", null, null, null, null, null
        );
    }

    @Test
    void passesExamModeAndPartToAttemptService() throws Exception {
        CreateAttemptRequest request = new CreateAttemptRequest(
                "test-1",
                "PART",
                6
        );
        Map<String, Object> expected = Map.of(
                "id", "attempt-part-6",
                "mode", "PART",
                "selectedPart", 6
        );
        when(authenticationService.requireUid("Bearer firebase-id-token"))
                .thenReturn("firebase-uid-123");
        when(attemptService.createOrResume(
                "firebase-uid-123", "test-1", "PART", 6, null, null, null
        ))
                .thenReturn(expected);

        Map<String, Object> result = controller.createAttempt(
                request,
                "Bearer firebase-id-token"
        );

        assertEquals(expected, result);
        verify(attemptService).createOrResume(
                "firebase-uid-123", "test-1", "PART", 6, null, null, null
        );
    }

    @Test
    void passesMultiplePartsAndCustomDurationToAttemptService() throws Exception {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setTestId("test-1");
        request.setMode("PART");
        request.setParts(List.of(5, 6));
        request.setDurationMinutes(25);
        Map<String, Object> expected = Map.of(
                "id", "attempt-parts-5-6",
                "selectedParts", List.of(5, 6)
        );
        when(authenticationService.requireUid("Bearer firebase-id-token"))
                .thenReturn("firebase-uid-123");
        when(attemptService.createOrResume(
                "firebase-uid-123",
                "test-1",
                "PART",
                null,
                List.of(5, 6),
                25,
                null
        )).thenReturn(expected);

        Map<String, Object> result = controller.createAttempt(request, "Bearer firebase-id-token");

        assertEquals(expected, result);
        verify(attemptService).createOrResume(
                "firebase-uid-123",
                "test-1",
                "PART",
                null,
                List.of(5, 6),
                25,
                null
        );
    }

    @Test
    void submitsAttemptForReviewWithAuthenticatedUser() throws Exception {
        Map<String, Object> expected = Map.of(
                "attemptId", "attempt-123",
                "totalCorrect", 4
        );
        when(authenticationService.requireUid("Bearer firebase-id-token"))
                .thenReturn("firebase-uid-123");
        when(attemptService.submitForReview("firebase-uid-123", "attempt-123"))
                .thenReturn(expected);

        Map<String, Object> result = controller.submitForReview(
                "attempt-123",
                "Bearer firebase-id-token"
        );

        assertEquals(expected, result);
        verify(attemptService).submitForReview("firebase-uid-123", "attempt-123");
    }
}
