package com.toeic.service.user;

import com.toeic.dao.attempt.AttemptDao;
import com.toeic.model.attempt.AttemptResult;
import com.toeic.model.attempt.Attempt;
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
        attempt.setResult(AttemptResult.builder()
                .listeningTotalQuestions(100)
                .listeningScore(390)
                .readingTotalQuestions(100)
                .readingScore(360)
                .build());
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
        when(attemptDao.findHistoryByUserId("user-1")).thenReturn(List.of(attempt));

        List<Map<String, Object>> history = service.getAttempts("user-1");

        assertEquals("PRACTICE", history.getFirst().get("type"));
    }

    @Test
    void includesSubmittedAndResumablePracticeButHidesUnfinishedMocks() throws Exception {
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

        Attempt paused = new Attempt();
        paused.setId("practice-1");
        paused.setType("PRACTICE");
        paused.setStatus("PAUSED");
        paused.setStartedAt(300L);
        paused.setPausedAt(1_000L);
        paused.setSectionEndAt(13_000L);

        when(attemptDao.findHistoryByUserId("user-1")).thenReturn(List.of(paused, unfinished, submitted));

        List<Map<String, Object>> history = service.getAttempts("user-1");

        assertEquals(2, history.size());
        assertEquals("practice-1", history.getFirst().get("id"));
        assertEquals(12L, history.getFirst().get("pausedRemainingSeconds"));
        assertEquals("submitted-1", history.get(1).get("id"));
    }

    @Test
    void excludesPracticeScoresFromExamStatistics() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        UserLearningService service = new UserLearningService(attemptDao);

        Attempt exam = new Attempt();
        exam.setType("FULL_TEST");
        exam.setStatus("COMPLETED");
        exam.setScore(700);
        exam.setResult(AttemptResult.builder().listeningTotalQuestions(100).listeningScore(350).build());

        Attempt practice = new Attempt();
        practice.setType("PRACTICE");
        practice.setStatus("COMPLETED");
        practice.setScore(990);
        practice.setResult(AttemptResult.builder().listeningTotalQuestions(100).listeningScore(495).build());

        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(exam, practice));

        Map<String, Object> result = service.getStatistics("user-1");

        assertEquals(700, result.get("averageScore"));
        assertEquals(350, result.get("averageListeningScore"));
        assertEquals(1, result.get("completedExamAttempts"));
        assertEquals(1, result.get("completedPracticeAttempts"));
    }
}
