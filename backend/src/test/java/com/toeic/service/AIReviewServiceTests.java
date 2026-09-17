package com.toeic.service;

import com.toeic.dao.AIAnalysisDao;
import com.toeic.dao.AttemptDao;
import com.toeic.dto.ai.AIReviewCompleted;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AIReviewServiceTests {

    private final AttemptDao attemptDao = mock(AttemptDao.class);
    private final AIAnalysisDao analysisDao = mock(AIAnalysisDao.class);
    private final AIReviewRequestPublisher publisher = mock(AIReviewRequestPublisher.class);
    private final AIReviewService service = new AIReviewService(attemptDao, analysisDao, publisher);

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
