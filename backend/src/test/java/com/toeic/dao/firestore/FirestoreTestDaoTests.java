package com.toeic.dao.firestore;

import com.google.cloud.Timestamp;
import com.toeic.model.enums.TestStatus;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class FirestoreTestDaoTests {

    @Test
    void mapsFirestoreTimestampsToEpochMilliseconds() {
        Timestamp createdAt = Timestamp.ofTimeSecondsAndNanos(1_700_000_000L, 123_000_000);
        Timestamp updatedAt = Timestamp.ofTimeSecondsAndNanos(1_700_000_100L, 456_000_000);
        Date submittedAt = new Date(1_700_000_200_789L);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("title", "Test 1");
        data.put("totalQuestions", 200L);
        data.put("status", "APPROVED");
        data.put("createdAt", createdAt);
        data.put("updatedAt", updatedAt);
        data.put("submittedAt", submittedAt);
        data.put("reviewedAt", null);

        com.toeic.model.Test result = FirestoreTestDao.metadataFrom("test-1", data);

        assertEquals("test-1", result.getTestId());
        assertEquals("Test 1", result.getTitle());
        assertEquals(200, result.getTotalQuestions());
        assertEquals(TestStatus.APPROVED, result.getStatus());
        assertEquals(1_700_000_000_123L, result.getCreatedAt());
        assertEquals(1_700_000_100_456L, result.getUpdatedAt());
        assertEquals(1_700_000_200_789L, result.getSubmittedAt());
        assertNull(result.getReviewedAt());
        assertNull(result.getParts());
    }

    @Test
    void preservesNumericEpochMilliseconds() {
        Map<String, Object> data = Map.of(
                "createdAt", 1_700_000_000_123L,
                "updatedAt", 1_700_000_100_456L,
                "reviewedAt", 1_700_000_300_999L,
                "status", TestStatus.REJECTED
        );

        com.toeic.model.Test result = FirestoreTestDao.metadataFrom("test-2", data);

        assertEquals(1_700_000_000_123L, result.getCreatedAt());
        assertEquals(1_700_000_100_456L, result.getUpdatedAt());
        assertEquals(1_700_000_300_999L, result.getReviewedAt());
        assertEquals(TestStatus.REJECTED, result.getStatus());
    }

    @Test
    void mapsLegacyPublishedStatusToApproved() {
        com.toeic.model.Test result = FirestoreTestDao.metadataFrom(
                "legacy-test",
                Map.of("status", "PUBLISHED")
        );

        assertEquals(TestStatus.APPROVED, result.getStatus());
    }
}
