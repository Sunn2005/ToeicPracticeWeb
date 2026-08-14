package com.toeic.service;

import com.toeic.dao.TestDao;
import com.toeic.model.TestPart;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestServiceTests {

    private TestService testService;

    @BeforeEach
    void setUp() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        TestDao testDao = mock(TestDao.class);

        com.toeic.model.Test test;
        try (InputStream input = getClass().getResourceAsStream(
                "/data/ets-2026-test-1-data.json"
        )) {
            test = objectMapper.readValue(input, com.toeic.model.Test.class);
        }

        when(testDao.findMetadataById(test.getTestId())).thenReturn(Optional.of(test));
        for (TestPart part : test.getParts()) {
            when(testDao.findPart(test.getTestId(), part.getPartNumber()))
                    .thenReturn(Optional.of(part));
        }
        testService = new TestService(testDao, objectMapper);
    }

    @Test
    void loadsTypedTestAndBuildsCompleteAnswerKey() throws Exception {
        Map<Integer, String> answerKey = testService.getAnswerKey("ets-2026-test-1");

        assertEquals(200, answerKey.size());
        assertEquals("B", answerKey.get(1));
        assertTrue(answerKey.containsKey(200));
    }

    @Test
    void removesAnswersAndListeningTextFromExamResponse() throws Exception {
        Map<String, Object> exam = testService.getExamTest("ets-2026-test-1");
        String serialized = new ObjectMapper().writeValueAsString(exam);

        assertFalse(serialized.contains("correctAnswer"));
        assertFalse(serialized.contains("explanation"));
        assertFalse(serialized.contains("transcript"));

        Map<?, ?> partOne = (Map<?, ?>) ((java.util.List<?>) exam.get("parts")).getFirst();
        Map<?, ?> firstQuestion = (Map<?, ?>) ((java.util.List<?>) partOne.get("questions")).getFirst();
        Map<?, ?> firstOption = (Map<?, ?>) ((java.util.List<?>) firstQuestion.get("answers")).getFirst();
        assertNull(firstOption.get("content"));
        assertFalse(firstOption.containsKey("content"));
    }

    @Test
    void keepsCorrectAnswersInReviewResponse() throws Exception {
        Map<String, Object> review = testService.getReviewTest("ets-2026-test-1");
        String serialized = new ObjectMapper().writeValueAsString(review);

        assertTrue(serialized.contains("correctAnswer"));
        assertTrue(serialized.contains("transcript"));
    }
}
