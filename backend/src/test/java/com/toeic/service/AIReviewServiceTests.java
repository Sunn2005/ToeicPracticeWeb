package com.toeic.service;

import com.toeic.dao.AIAnalysisDao;
import com.toeic.dao.AttemptDao;
import com.toeic.dao.SubscriptionDao;
import com.toeic.controller.ApiCodeException;
import com.toeic.dto.ai.AIReviewCompleted;
import com.toeic.model.Attempt;
import com.toeic.model.Subscription;
import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AIReviewServiceTests {

    private final AttemptDao attemptDao = mock(AttemptDao.class);
    private final AIAnalysisDao analysisDao = mock(AIAnalysisDao.class);
    private final AIReviewRequestPublisher publisher = mock(AIReviewRequestPublisher.class);
    private final SubscriptionDao subscriptionDao = mock(SubscriptionDao.class);
    private final SubscriptionService subscriptionService = new SubscriptionService(subscriptionDao,
            Clock.fixed(Instant.ofEpochMilli(1000), ZoneOffset.UTC));
    private final AIReviewService service = new AIReviewService(
            attemptDao, analysisDao, publisher, subscriptionService);

    @BeforeEach
    void setUp() throws Exception {
        when(subscriptionDao.findByUserId("user-1")).thenReturn(Optional.of(subscription(2000)));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsNonProRequestsWithoutMutationOrPublishing(boolean refresh) throws Exception {
        when(subscriptionDao.findByUserId("user-1")).thenReturn(Optional.empty());
        assertDeniedWithoutSideEffects(refresh);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsExpiredRequestsWithoutMutationOrPublishing(boolean refresh) throws Exception {
        when(subscriptionDao.findByUserId("user-1")).thenReturn(Optional.of(subscription(1000)));
        assertDeniedWithoutSideEffects(refresh);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsRequestsWithoutAnalysisEntitlement(boolean refresh) throws Exception {
        Subscription chatOnly = subscription(2000);
        chatOnly.setEntitlements(List.of(Entitlement.AI_CHAT));
        when(subscriptionDao.findByUserId("user-1")).thenReturn(Optional.of(chatOnly));
        assertDeniedWithoutSideEffects(refresh);
    }

    private void assertDeniedWithoutSideEffects(boolean refresh) throws Exception {
        Attempt attempt = attempt("FULL_TEST", "FULL", "COMPLETED", "user-1");
        attempt.setAiAnalysisStatus(refresh ? "COMPLETED" : "NOT_REQUESTED");
        attempt.setAiAnalysisId(refresh ? "existing-analysis" : null);
        attempt.setAiAnalysisRequestedAt(100L);
        attempt.setUpdatedAt(200L);
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(attempt));

        ApiCodeException error = assertThrows(ApiCodeException.class,
                () -> service.requestAnalysis("user-1", "attempt-1", refresh));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
        assertEquals("PRO_REQUIRED", error.getCode());
        assertEquals(refresh ? "COMPLETED" : "NOT_REQUESTED", attempt.getAiAnalysisStatus());
        assertEquals(refresh ? "existing-analysis" : null, attempt.getAiAnalysisId());
        assertEquals(100L, attempt.getAiAnalysisRequestedAt());
        assertEquals(200L, attempt.getUpdatedAt());
        verify(attemptDao, never()).save(org.mockito.ArgumentMatchers.any());
        verifyNoInteractions(publisher);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void completedResultRemainsReadableWithoutEffectivePro(boolean expired) throws Exception {
        when(subscriptionDao.findByUserId("user-1")).thenReturn(
                expired ? Optional.of(subscription(1000)) : Optional.empty());
        Attempt attempt = attempt("FULL_TEST", "FULL", "COMPLETED", "user-1");
        attempt.setAiAnalysisStatus("COMPLETED");
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(attempt));
        Map<String, Object> result = Map.of("summary", "Stored analysis");
        when(analysisDao.findByAttemptId("attempt-1")).thenReturn(Optional.of(Map.of(
                "userId", "user-1", "result", result)));

        Map<String, Object> response = service.getAnalysis("user-1", "attempt-1");

        assertEquals("COMPLETED", response.get("status"));
        assertEquals(result, response.get("result"));
        verifyNoInteractions(subscriptionDao, publisher);
        verify(attemptDao, never()).save(org.mockito.ArgumentMatchers.any());
    }

    private Subscription subscription(long expiresAt) {
        Subscription subscription = new Subscription();
        subscription.setUserId("user-1");
        subscription.setPlanCode("PRO");
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setStartsAt(0L);
        subscription.setExpiresAt(expiresAt);
        subscription.setEntitlements(List.of(Entitlement.AI_ANALYSIS));
        return subscription;
    }

    @Test
    void rejectsPracticeAndUnfinishedAttempts() throws Exception {
        Attempt practice = attempt("PRACTICE", "PART", "COMPLETED", "user-1");
        when(attemptDao.findById("practice")).thenReturn(Optional.of(practice));
        assertThrows(ResponseStatusException.class,
                () -> service.requestAnalysis("user-1", "practice"));

        Attempt unfinished = attempt("FULL_TEST", "FULL", "IN_PROGRESS", "user-1");
        when(attemptDao.findById("unfinished")).thenReturn(Optional.of(unfinished));
        assertThrows(ResponseStatusException.class,
                () -> service.requestAnalysis("user-1", "unfinished"));
    }

    @Test
    void rejectsAttemptOwnedByAnotherUser() throws Exception {
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(
                attempt("FULL_TEST", "FULL", "COMPLETED", "user-2")
        ));
        assertThrows(ResponseStatusException.class,
                () -> service.requestAnalysis("user-1", "attempt-1"));
    }

    @Test
    void persistsPendingBeforePublishingAndDoesNotCreateDuplicateJob() throws Exception {
        Attempt attempt = attempt("FULL_TEST", "FULL", "COMPLETED", "user-1");
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(attempt));

        Map<String, Object> response = service.requestAnalysis("user-1", "attempt-1");

        assertEquals("PENDING", response.get("status"));
        InOrder order = inOrder(attemptDao, publisher);
        order.verify(attemptDao).save(attempt);
        order.verify(publisher).publish(org.mockito.ArgumentMatchers.any());

        Map<String, Object> duplicate = service.requestAnalysis("user-1", "attempt-1");
        assertEquals("PENDING", duplicate.get("status"));
        verify(publisher, times(1)).publish(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void allowsUserToRefreshACompletedAnalysis() throws Exception {
        Attempt attempt = attempt("FULL_TEST", "FULL", "COMPLETED", "user-1");
        attempt.setAiAnalysisStatus("COMPLETED");
        attempt.setAiAnalysisId("attempt-1");
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(attempt));

        Map<String, Object> response = service.requestAnalysis("user-1", "attempt-1", true);

        assertEquals("PENDING", response.get("status"));
        assertEquals(null, attempt.getAiAnalysisId());
        verify(attemptDao).save(attempt);
        verify(publisher).publish(new com.toeic.dto.ai.AIReviewRequest(
                "attempt-1", "user-1", true
        ));
    }

    @Test
    void completedMessageIsIdempotentAndRequiresStoredAnalysis() throws Exception {
        Attempt attempt = attempt("FULL_TEST", "FULL", "COMPLETED", "user-1");
        attempt.setAiAnalysisStatus("PROCESSING");
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(attempt));
        when(analysisDao.findByAttemptId("attempt-1")).thenReturn(Optional.of(Map.of(
                "attemptId", "attempt-1"
        )));

        AIReviewCompleted message = new AIReviewCompleted(
                "attempt-1", "user-1", "attempt-1", "COMPLETED"
        );
        service.handleCompleted(message);
        service.handleCompleted(message);

        assertEquals("COMPLETED", attempt.getAiAnalysisStatus());
        assertEquals("attempt-1", attempt.getAiAnalysisId());
        verify(attemptDao).save(attempt);
    }

    @Test
    void returnsStoredErrorCodeForFailedAnalysis() throws Exception {
        Attempt attempt = attempt("FULL_TEST", "FULL", "COMPLETED", "user-1");
        attempt.setAiAnalysisStatus("FAILED");
        when(attemptDao.findById("attempt-1")).thenReturn(Optional.of(attempt));
        when(analysisDao.findByAttemptId("attempt-1")).thenReturn(Optional.of(Map.of(
                "userId", "user-1",
                "error", "INVALID_GEMINI_OUTPUT"
        )));

        Map<String, Object> response = service.getAnalysis("user-1", "attempt-1");

        assertEquals("FAILED", response.get("status"));
        assertEquals("INVALID_GEMINI_OUTPUT", response.get("errorCode"));
        assertEquals(null, response.get("result"));
    }

    private Attempt attempt(String type, String mode, String status, String userId) {
        Attempt attempt = new Attempt();
        attempt.setId(type.equals("PRACTICE") ? "practice" : "attempt-1");
        attempt.setUserId(userId);
        attempt.setType(type);
        attempt.setMode(mode);
        attempt.setStatus(status);
        attempt.setAiAnalysisStatus("NOT_REQUESTED");
        return attempt;
    }
}
