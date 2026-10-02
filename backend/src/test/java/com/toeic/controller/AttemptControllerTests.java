package com.toeic.controller;

import com.toeic.dto.CreateAttemptRequest;
import com.toeic.dto.AttemptResultDto;
import com.toeic.model.enums.UserRole;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.AttemptService;
import com.toeic.service.AIReviewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AttemptControllerTests {

    private AttemptService attemptService;
    private AttemptController controller;
    private AIReviewService aiReviewService;
    private ToeicUserPrincipal principal;

    @BeforeEach
    void setUp() {
        attemptService = mock(AttemptService.class);
        aiReviewService = mock(AIReviewService.class);
        controller = new AttemptController(attemptService, aiReviewService);
        principal = new ToeicUserPrincipal(
                "firebase-uid-123",
                "user@example.com",
                "User",
                null,
                UserRole.USER,
                1L,
                1L
        );
    }

    @Test
    void createsAttemptWithUidFromVerifiedFirebaseToken() throws Exception {
        Map<String, Object> expected = Map.of(
                "id", "attempt-123",
                "userId", "firebase-uid-123",
                "testId", "test-1",
                "status", "IN_PROGRESS"
        );
        when(attemptService.createOrResume(
                "firebase-uid-123", "test-1", null, null, null, null, null, null
        ))
                .thenReturn(expected);

        Map<String, Object> result = controller.createAttempt(
                new CreateAttemptRequest("test-1"),
                principal
        );

        assertEquals(expected, result);
        verify(attemptService).createOrResume(
                "firebase-uid-123", "test-1", null, null, null, null, null, null
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
        when(attemptService.createOrResume(
                "firebase-uid-123", "test-1", "PART", 6, null, null, null, null
        ))
                .thenReturn(expected);

        Map<String, Object> result = controller.createAttempt(
                request,
                principal
        );

        assertEquals(expected, result);
        verify(attemptService).createOrResume(
                "firebase-uid-123", "test-1", "PART", 6, null, null, null, null
        );
    }

    @Test
    void passesMultiplePartsAndCustomDurationToAttemptService() throws Exception {
        CreateAttemptRequest request = new CreateAttemptRequest();
        request.setTestId("test-1");
        request.setMode("PART");
        request.setParts(List.of(5, 6));
        request.setDurationMinutes(25);
        request.setRestartExisting(true);
        Map<String, Object> expected = Map.of(
                "id", "attempt-parts-5-6",
                "selectedParts", List.of(5, 6)
        );
        when(attemptService.createOrResume(
                "firebase-uid-123",
                "test-1",
                "PART",
                null,
                List.of(5, 6),
                25,
                null,
                true
        )).thenReturn(expected);

        Map<String, Object> result = controller.createAttempt(request, principal);

        assertEquals(expected, result);
        verify(attemptService).createOrResume(
                "firebase-uid-123",
                "test-1",
                "PART",
                null,
                List.of(5, 6),
                25,
                null,
                true
        );
    }

    @Test
    void submitsAttemptForReviewWithAuthenticatedUser() throws Exception {
        AttemptResultDto expected = AttemptResultDto.builder()
                .attemptId("attempt-123")
                .totalCorrect(4)
                .build();
        when(attemptService.submitForReview("firebase-uid-123", "attempt-123"))
                .thenReturn(expected);

        AttemptResultDto result = controller.submitForReview(
                "attempt-123",
                principal
        );

        assertEquals(expected, result);
        verify(attemptService).submitForReview("firebase-uid-123", "attempt-123");
    }
}
