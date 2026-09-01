package com.toeic.service;

import com.toeic.dao.AttemptDao;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

class UserLearningServiceTests {

    @Test
    void aggregatesCompletedAttemptScores() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        UserLearningService service = new UserLearningService(attemptDao);
        Attempt attempt = new Attempt();
        attempt.setStatus("COMPLETED");
        attempt.setScore(750);
        attempt.setSubmittedAt(1_700_000_000_000L);
        attempt.setResult(Map.of(
                "listeningTotalQuestions", 100,
                "listeningScore", 390,
                "readingTotalQuestions", 100,
                "readingScore", 360
        ));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(attempt));

        Map<String, Object> result = service.getStatistics("user-1");

        assertEquals(1, result.get("completedAttempts"));
        assertEquals(750, result.get("averageScore"));
        assertEquals(390, result.get("averageListeningScore"));
        assertEquals(360, result.get("averageReadingScore"));
    }

    @Test
    void deletesOnlyAnAttemptOwnedByTheCurrentUser() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        UserLearningService service = new UserLearningService(attemptDao);
        Attempt attempt = new Attempt();
        attempt.setId("attempt-1");
        attempt.setUserId("user-1");
        when(attemptDao.findById("attempt-1")).thenReturn(java.util.Optional.of(attempt));

        service.deleteAttempt("user-1", "attempt-1");

        verify(attemptDao).delete("attempt-1");
    }

    @Test
    void includesAttemptTypeInHistory() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        UserLearningService service = new UserLearningService(attemptDao);
        Attempt attempt = new Attempt();
        attempt.setId("practice-1");
        attempt.setType("PRACTICE");
        attempt.setStatus("COMPLETED");
        attempt.setStartedAt(100L);
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(attempt));

        List<Map<String, Object>> history = service.getAttempts("user-1");

        assertEquals("PRACTICE", history.getFirst().get("type"));
    }

    @Test
    void includesOnlySubmittedAttemptsInHistory() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        UserLearningService service = new UserLearningService(attemptDao);

        Attempt submitted = new Attempt();
        submitted.setId("submitted-1");
        submitted.setStatus("COMPLETED");
        submitted.setStartedAt(100L);

        Attempt unfinished = new Attempt();
        unfinished.setId("unfinished-1");
        unfinished.setStatus("IN_PROGRESS");
        unfinished.setStartedAt(200L);

        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(unfinished, submitted));

        List<Map<String, Object>> history = service.getAttempts("user-1");

        assertEquals(1, history.size());
        assertEquals("submitted-1", history.getFirst().get("id"));
    }
}
