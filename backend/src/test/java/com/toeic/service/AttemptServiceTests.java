package com.toeic.service;

import com.toeic.dao.AttemptDao;
import com.toeic.dto.AttemptResultDto;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
        assertFalse((Boolean) response.get("resumed"));
    }

    @Test
    void identifiesWhenAnExistingAttemptIsResumed() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt existing = inProgressAttempt(
                "existing-practice-full",
                List.of(1, 2, 3, 4, 5, 6, 7),
                "READING",
                101
        );
        existing.setType("PRACTICE");
        existing.setMode("FULL");

        when(testService.getMetadata("test-1")).thenReturn(Map.of("testId", "test-1"));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(existing));
        when(attemptDao.findAnswers("existing-practice-full")).thenReturn(Map.of());

        Map<String, Object> response = attemptService.createOrResume(
                "user-1", "test-1", "FULL", null,
                List.of(1, 2, 3, 4, 5, 6, 7), null, "PRACTICE"
        );

        assertEquals("existing-practice-full", response.get("id"));
        assertEquals("READING", response.get("currentSection"));
        assertTrue((Boolean) response.get("resumed"));
    }

    @Test
    void restartsAnExistingAttemptFromListeningWhenRequested() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt existing = inProgressAttempt(
                "old-practice-full",
                List.of(1, 2, 3, 4, 5, 6, 7),
                "READING",
                101
        );
        existing.setType("PRACTICE");
        existing.setMode("FULL");

        when(testService.getMetadata("test-1")).thenReturn(Map.of("testId", "test-1"));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(existing));
        when(attemptDao.nextId()).thenReturn("new-practice-full");
        when(attemptDao.findAnswers("new-practice-full")).thenReturn(Map.of());

        Map<String, Object> response = attemptService.createOrResume(
                "user-1", "test-1", "FULL", null,
                List.of(1, 2, 3, 4, 5, 6, 7), null, "PRACTICE", true
        );

        verify(attemptDao).delete("old-practice-full");
        assertEquals("new-practice-full", response.get("id"));
        assertEquals("LISTENING", response.get("currentSection"));
        assertEquals(1, response.get("currentQuestionNumber"));
        assertFalse((Boolean) response.get("resumed"));
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
    void createsPracticeAttemptWithoutResumingMockTest() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);

        Attempt mockAttempt = inProgressAttempt("mock-attempt", List.of(5), "READING", 101);
        when(testService.getMetadata("test-1")).thenReturn(Map.of("testId", "test-1"));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of(mockAttempt));
        when(attemptDao.nextId()).thenReturn("practice-attempt");
        when(attemptDao.findAnswers("practice-attempt")).thenReturn(Map.of());

        attemptService.createOrResume(
                "user-1",
                "test-1",
                "PART",
                5,
                List.of(5),
                null,
                "PRACTICE"
        );

        ArgumentCaptor<Attempt> captor = ArgumentCaptor.forClass(Attempt.class);
        verify(attemptDao).save(captor.capture());
        assertEquals("PRACTICE", captor.getValue().getType());
        assertEquals("practice-attempt", captor.getValue().getId());
        assertFalse(captor.getValue().getTimed());
        assertNull(captor.getValue().getTimeLimitSeconds());
        assertNull(captor.getValue().getSectionEndAt());
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

        AttemptResultDto result = attemptService.submit("user-1", "attempt-5-7");

        assertEquals(84, result.getTotalQuestions());
        assertEquals(84, result.getReadingTotalQuestions());
        assertEquals(2, result.getTotalCorrect());
        assertEquals(List.of(5, 7), result.getSelectedParts());
    }

    @Test
    void submitsListeningFullTestDirectlyForReview() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt attempt = inProgressAttempt(
                "attempt-full-listening",
                List.of(1, 2, 3, 4, 5, 6, 7),
                "LISTENING",
                32
        );
        attempt.setMode("FULL");
        attempt.setLastQuestionNumber(200);
        attempt.setTotalQuestions(200);

        Map<Integer, String> answerKey = new LinkedHashMap<>();
        for (int number = 1; number <= 200; number++) {
            answerKey.put(number, "A");
        }
        when(attemptDao.findById("attempt-full-listening")).thenReturn(Optional.of(attempt));
        when(attemptDao.findAnswers("attempt-full-listening")).thenReturn(Map.of(1, "A", 32, "B"));
        when(testService.getAnswerKey("test-1")).thenReturn(answerKey);

        AttemptResultDto result = attemptService.submitForReview(
                "user-1",
                "attempt-full-listening"
        );

        assertEquals(1, result.getTotalCorrect());
        assertEquals(1, result.getTotalWrong());
        assertEquals(198, result.getTotalUnanswered());
        assertEquals("COMPLETED", attempt.getStatus());
        assertEquals("FINISHED", attempt.getCurrentSection());
        verify(attemptDao).save(attempt);
    }

    @Test
    void allowsPracticeFullModeToSubmitDuringListening() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt attempt = inProgressAttempt(
                "practice-full-listening",
                List.of(1, 2, 3, 4, 5, 6, 7),
                "LISTENING",
                1
        );
        attempt.setType("PRACTICE");
        attempt.setMode("FULL");
        attempt.setLastQuestionNumber(200);
        attempt.setTotalQuestions(200);

        Map<Integer, String> answerKey = new LinkedHashMap<>();
        for (int number = 1; number <= 200; number++) {
            answerKey.put(number, "A");
        }
        when(attemptDao.findById("practice-full-listening")).thenReturn(Optional.of(attempt));
        when(attemptDao.findAnswers("practice-full-listening")).thenReturn(Map.of(1, "A"));
        when(testService.getAnswerKey("test-1")).thenReturn(answerKey);

        AttemptResultDto result = attemptService.submit("user-1", "practice-full-listening");

        assertEquals(1, result.getTotalCorrect());
        assertEquals("PRACTICE", result.getType());
        assertEquals("COMPLETED", attempt.getStatus());
    }

    @Test
    void marksPracticeListeningReadyAtLastUnitUntilUserSubmits() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt attempt = inProgressAttempt("practice-part-1", List.of(1), "LISTENING", 6);
        attempt.setType("PRACTICE");

        when(attemptDao.findById("practice-part-1")).thenReturn(Optional.of(attempt));
        when(attemptDao.findAnswers("practice-part-1")).thenReturn(Map.of(6, "A"));

        Map<String, Object> response = attemptService.nextListening("user-1", "practice-part-1");

        assertEquals("IN_PROGRESS", response.get("status"));
        assertEquals("AWAITING_SUBMISSION", response.get("currentSection"));
        assertEquals(6, response.get("currentQuestionNumber"));
    }

    @Test
    void marksMockListeningReadyAtLastUnitInsteadOfAutoSubmitting() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);
        Attempt attempt = inProgressAttempt("mock-listening", List.of(4), "LISTENING", 98);
        attempt.setMode("LISTENING");

        when(attemptDao.findById("mock-listening")).thenReturn(Optional.of(attempt));
        when(attemptDao.findAnswers("mock-listening")).thenReturn(Map.of(98, "A"));

        Map<String, Object> response = attemptService.nextListening("user-1", "mock-listening");

        assertEquals("IN_PROGRESS", response.get("status"));
        assertEquals("AWAITING_SUBMISSION", response.get("currentSection"));
        verify(attemptDao).save(attempt);
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
