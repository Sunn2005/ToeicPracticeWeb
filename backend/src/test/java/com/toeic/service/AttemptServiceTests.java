package com.toeic.service;

import com.toeic.dao.AttemptDao;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AttemptServiceTests {

    @Test
    void createsAttemptThroughDaoWithoutKnowingFirestore() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);

        when(testService.getMetadata("test-1")).thenReturn(Map.of("testId", "test-1"));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of());
        when(attemptDao.nextId()).thenReturn("attempt-1");
        when(attemptDao.findAnswers("attempt-1")).thenReturn(Map.of());

        Map<String, Object> response = attemptService.createOrResume(
                "user-1",
                "test-1",
                "FULL",
                null
        );

        ArgumentCaptor<Attempt> captor = ArgumentCaptor.forClass(Attempt.class);
        verify(attemptDao).save(captor.capture());
        assertEquals("attempt-1", captor.getValue().getId());
        assertEquals("user-1", captor.getValue().getUserId());
        assertEquals("IN_PROGRESS", captor.getValue().getStatus());
        assertEquals("attempt-1", response.get("id"));
    }

    @Test
    void createsMultiPartAttemptWithCustomCountdown() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);

        when(testService.getMetadata("test-1")).thenReturn(Map.of("testId", "test-1"));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of());
        when(attemptDao.nextId()).thenReturn("attempt-parts-5-6");
        when(attemptDao.findAnswers("attempt-parts-5-6")).thenReturn(Map.of());

        Map<String, Object> response = attemptService.createOrResume(
                "user-1",
                "test-1",
                "PART",
                null,
                List.of(5, 6),
                25
        );

        ArgumentCaptor<Attempt> captor = ArgumentCaptor.forClass(Attempt.class);
        verify(attemptDao).save(captor.capture());
        Attempt saved = captor.getValue();
        assertEquals(List.of(5, 6), saved.getSelectedParts());
        assertNull(saved.getSelectedPart());
        assertEquals(46, saved.getTotalQuestions());
        assertEquals(101, saved.getFirstQuestionNumber());
        assertEquals(146, saved.getLastQuestionNumber());
        assertEquals(25 * 60, saved.getTimeLimitSeconds());
        assertEquals("READING", saved.getCurrentSection());
        assertEquals(List.of(5, 6), response.get("selectedParts"));
    }

    @Test
    void skipsUnselectedListeningPartsWhenAudioAdvances() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt attempt = inProgressAttempt("attempt-1-3", List.of(1, 3), "LISTENING", 6);

        when(attemptDao.findById("attempt-1-3")).thenReturn(Optional.of(attempt));
        when(attemptDao.findAnswers("attempt-1-3")).thenReturn(Map.of());

        Map<String, Object> response = attemptService.nextListening("user-1", "attempt-1-3");

        assertEquals(32, response.get("currentQuestionNumber"));
        verify(attemptDao).save(attempt);
        assertEquals(32, attempt.getCurrentQuestionNumber());
    }

    @Test
    void scoresOnlyQuestionsFromSelectedParts() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt attempt = inProgressAttempt("attempt-5-7", List.of(5, 7), "READING", 101);
        attempt.setFirstQuestionNumber(101);
        attempt.setLastQuestionNumber(200);
        attempt.setTotalQuestions(84);

        Map<Integer, String> answerKey = new LinkedHashMap<>();
        for (int number = 1; number <= 200; number++) {
            answerKey.put(number, "A");
        }
        when(attemptDao.findById("attempt-5-7")).thenReturn(Optional.of(attempt));
        when(attemptDao.findAnswers("attempt-5-7")).thenReturn(Map.of(101, "A", 147, "A"));
        when(testService.getAnswerKey("test-1")).thenReturn(answerKey);

        Map<String, Object> result = attemptService.submit("user-1", "attempt-5-7");

        assertEquals(84, result.get("totalQuestions"));
        assertEquals(84, result.get("readingTotalQuestions"));
        assertEquals(2, result.get("totalCorrect"));
        assertEquals(List.of(5, 7), result.get("selectedParts"));
    }

    private Attempt inProgressAttempt(
            String id,
            List<Integer> selectedParts,
            String section,
            int currentQuestion
    ) {
        Attempt attempt = new Attempt();
        attempt.setId(id);
        attempt.setUserId("user-1");
        attempt.setTestId("test-1");
        attempt.setType("FULL_TEST");
        attempt.setMode("PART");
        attempt.setSelectedParts(selectedParts);
        attempt.setStatus("IN_PROGRESS");
        attempt.setCurrentSection(section);
        attempt.setCurrentQuestionNumber(currentQuestion);
        attempt.setFirstQuestionNumber(1);
        attempt.setLastQuestionNumber(70);
        attempt.setTotalQuestions(45);
        attempt.setStartedAt(System.currentTimeMillis());
        attempt.setSectionEndAt(System.currentTimeMillis() + 30 * 60 * 1000L);
        attempt.setOverallEndAt(attempt.getSectionEndAt());
        attempt.setTimeLimitSeconds(30 * 60);
        return attempt;
    }
}
