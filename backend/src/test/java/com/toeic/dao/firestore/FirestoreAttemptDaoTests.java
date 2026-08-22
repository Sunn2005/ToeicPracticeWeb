package com.toeic.dao.firestore;

import com.google.cloud.Timestamp;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class FirestoreAttemptDaoTests {

    @Test
    void mapsLegacyFirestoreTimestampsAndNumericLists() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("userId", "user-1");
        data.put("testId", "test-1");
        data.put("type", "FULL_TEST");
        data.put("mode", "PART");
        data.put("selectedParts", List.of(5L, 6L));
        data.put("timeLimitSeconds", 1_500L);
        data.put("status", "IN_PROGRESS");
        data.put("currentSection", "READING");
        data.put("currentQuestionNumber", 101L);
        data.put("startedAt", Timestamp.ofTimeSecondsAndNanos(
                1_700_000_000L,
                123_000_000
        ));
        data.put("updatedAt", new Date(1_700_000_100_456L));
        data.put("sectionEndAt", 1_700_000_200_789L);

        Attempt result = FirestoreAttemptDao.attemptFrom("attempt-1", data);

        assertEquals("attempt-1", result.getId());
        assertEquals("user-1", result.getUserId());
        assertEquals(List.of(5, 6), result.getSelectedParts());
        assertEquals(1_500, result.getTimeLimitSeconds());
        assertEquals(101, result.getCurrentQuestionNumber());
        assertEquals(1_700_000_000_123L, result.getStartedAt());
        assertEquals(1_700_000_100_456L, result.getUpdatedAt());
        assertEquals(1_700_000_200_789L, result.getSectionEndAt());
        assertNull(result.getSubmittedAt());
    }

    @Test
    void preservesStoredIdResultAndLegacyAnswers() {
        Map<String, Object> data = Map.of(
                "id", "stored-attempt",
                "result", Map.of("totalScore", 750L),
                "answers", Map.of("101", "A")
        );

        Attempt result = FirestoreAttemptDao.attemptFrom("document-id", data);

        assertEquals("stored-attempt", result.getId());
        assertEquals(750L, result.getResult().get("totalScore"));
        assertEquals("A", result.getAnswers().get("101"));
    }
}
