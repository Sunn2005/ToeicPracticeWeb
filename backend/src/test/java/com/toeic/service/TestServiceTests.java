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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import java.util.List;

class TestServiceTests {

    private TestService testService;
    private String testId;
    private com.toeic.model.Test sourceTest;

    @BeforeEach
    void setUp() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        TestDao testDao = mock(TestDao.class);

        try (InputStream input = getClass().getResourceAsStream(
                "/data/test-1-data.json"
        )) {
            sourceTest = objectMapper.readValue(input, com.toeic.model.Test.class);
        }
        testId = sourceTest.getTestId();

        when(testDao.findMetadataById(sourceTest.getTestId())).thenReturn(Optional.of(sourceTest));
        when(testDao.findParts(eq(sourceTest.getTestId()), any())).thenAnswer(invocation -> {
            List<Integer> requested = invocation.getArgument(1);
            return sourceTest.getParts().stream()
                    .filter(part -> requested.contains(part.getPartNumber()))
                    .toList();
        });
        for (TestPart part : sourceTest.getParts()) {
            when(testDao.findPart(sourceTest.getTestId(), part.getPartNumber()))
                    .thenReturn(Optional.of(part));
        }
        testService = new TestService(testDao, objectMapper);
    }

    @Test
    void loadsTypedTestAndBuildsCompleteAnswerKey() throws Exception {
        Map<Integer, String> answerKey = testService.getAnswerKey(testId);

        assertEquals(200, answerKey.size());
        assertEquals("B", answerKey.get(1));
        assertTrue(answerKey.containsKey(200));
    }

    @Test
    void loadsOnlyTheRequestedPartsForAPracticeExam() throws Exception {
        Map<String, Object> exam = testService.getExamTest(testId, List.of(5));
        List<?> parts = (List<?>) exam.get("parts");

        assertEquals(1, parts.size());
        assertEquals(5, ((Map<?, ?>) parts.getFirst()).get("partNumber"));
    }

    @Test
    void removesAnswersAndListeningTextFromExamResponse() throws Exception {
        Map<String, Object> exam = testService.getExamTest(testId);
        String serialized = new ObjectMapper().writeValueAsString(exam);

        assertFalse(serialized.contains("correctAnswer"));
        assertFalse(serialized.contains("questionTranslation"));
        assertFalse(serialized.contains("answerTranslation"));
        assertFalse(serialized.contains("Bài giảng sẽ diễn ra"));
        assertFalse(serialized.contains("detailedExplanation"));
        assertFalse(serialized.contains("transcript"));
        assertFalse(serialized.contains("transcriptTranslation"));
        assertFalse(serialized.contains("Nữ: Này Oliver"));
        assertTrue(serialized.contains("T01-P6-131-134.png"));
        assertTrue(serialized.contains("T01-P7-196-200-3.png"));

        Map<?, ?> partOne = (Map<?, ?>) ((java.util.List<?>) exam.get("parts")).getFirst();
        Map<?, ?> firstQuestion = (Map<?, ?>) ((java.util.List<?>) partOne.get("questions")).getFirst();
        Map<?, ?> firstOption = (Map<?, ?>) ((java.util.List<?>) firstQuestion.get("answers")).getFirst();
        assertNull(firstOption.get("content"));
        assertFalse(firstOption.containsKey("content"));
    }

    @Test
    void keepsCorrectAnswersInReviewResponse() throws Exception {
        Map<String, Object> review = testService.getReviewTest(testId);
        String serialized = new ObjectMapper().writeValueAsString(review);

        assertTrue(serialized.contains("correctAnswer"));
        assertTrue(serialized.contains("questionTranslation"));
        assertTrue(serialized.contains("answerTranslation"));
        assertTrue(serialized.contains("(A) băng qua"));
        assertTrue(serialized.contains("detailedExplanation"));
        assertTrue(serialized.contains("Bài giảng sẽ diễn ra"));
        assertTrue(serialized.contains("transcript"));
        assertTrue(serialized.contains("transcriptTranslation"));
        assertTrue(serialized.contains("Nữ: Này Oliver"));
        assertFalse(serialized.contains("\"translation\""));
        assertFalse(serialized.contains("\"explanation\""));
    }

    @Test
    void revealsSingleQuestionFeedbackOnlyAfterItIsAnswered() throws Exception {
        Map<String, Object> pending = testService.getPracticeFeedback(testId, 101, Map.of());
        assertEquals(false, pending.get("ready"));
        assertEquals(List.of(101), pending.get("pendingQuestionNumbers"));
        assertFalse(pending.containsKey("questions"));

        Map<String, Object> ready = testService.getPracticeFeedback(
                testId,
                101,
                Map.of(101, "B")
        );
        assertEquals(true, ready.get("ready"));
        Map<?, ?> question = (Map<?, ?>) ((List<?>) ready.get("questions")).getFirst();
        assertEquals(101, question.get("questionNumber"));
        assertEquals("B", question.get("selectedAnswer"));
        assertEquals("CORRECT", question.get("answerStatus"));
        assertTrue(question.containsKey("correctAnswer"));
        assertTrue(question.containsKey("detailedExplanation"));
    }

    @Test
    void waitsForEveryQuestionBeforeRevealingGroupFeedback() throws Exception {
        Map<String, Object> pending = testService.getPracticeFeedback(
                testId,
                32,
                Map.of(32, "A", 33, "B")
        );
        assertEquals(false, pending.get("ready"));
        assertEquals(List.of(34), pending.get("pendingQuestionNumbers"));

        Map<String, Object> ready = testService.getPracticeFeedback(
                testId,
                32,
                Map.of(32, "A", 33, "B", 34, "C")
        );
        assertEquals(true, ready.get("ready"));
        assertEquals(List.of(32, 33, 34), ready.get("questionNumbers"));
        assertEquals(3, ((List<?>) ready.get("questions")).size());
        assertTrue(String.valueOf(ready.get("transcript")).contains("cheddar"));
        assertTrue(String.valueOf(ready.get("transcriptTranslation")).contains("phô mai"));
    }

    @Test
    void treatsPartSixAndSevenPassagesAsFeedbackGroups() throws Exception {
        Map<String, Object> partSixPending = testService.getPracticeFeedback(
                testId,
                131,
                Map.of(131, "A", 132, "B", 133, "C")
        );
        assertEquals(false, partSixPending.get("ready"));
        assertEquals(List.of(134), partSixPending.get("pendingQuestionNumbers"));

        Map<String, Object> partSixReady = testService.getPracticeFeedback(
                testId,
                131,
                Map.of(131, "A", 132, "B", 133, "C", 134, "D")
        );
        assertEquals(true, partSixReady.get("ready"));
        assertEquals(4, ((List<?>) partSixReady.get("questions")).size());

        Map<String, Object> partSevenReady = testService.getPracticeFeedback(
                testId,
                147,
                Map.of(147, "A", 148, "B")
        );
        assertEquals(true, partSevenReady.get("ready"));
        assertEquals(List.of(147, 148), partSevenReady.get("questionNumbers"));
    }

    @Test
    void providesReadableTranscriptTranslationsForEveryPartThreeAndFourGroup() {
        List<TestPart> listeningParts = sourceTest.getParts().stream()
                .filter(part -> part.getPartNumber() == 3 || part.getPartNumber() == 4)
                .toList();

        assertEquals(2, listeningParts.size());
        assertEquals(23, listeningParts.stream().mapToInt(part -> part.getGroups().size()).sum());
        assertTrue(listeningParts.stream()
                .flatMap(part -> part.getGroups().stream())
                .allMatch(group -> group.getTranscript() != null
                        && group.getTranscript().contains("\n\n")
                        && group.getTranscriptTranslation() != null
                        && !group.getTranscriptTranslation().isBlank()
                        && group.getTranscriptTranslation().contains("\n\n")));
    }

    @Test
    void providesDetailedExplanationsForEveryPartThreeAndFourQuestion() throws Exception {
        List<com.toeic.model.Question> listeningGroupQuestions = sourceTest.getParts().stream()
                .filter(part -> part.getPartNumber() == 3 || part.getPartNumber() == 4)
                .flatMap(part -> part.getGroups().stream())
                .flatMap(group -> group.getQuestions().stream())
                .toList();

        assertEquals(69, listeningGroupQuestions.size());
        assertTrue(listeningGroupQuestions.stream().allMatch(question ->
                question.getDetailedExplanation() != null
                        && !question.getDetailedExplanation().isBlank()
        ));

        String serialized = new ObjectMapper().writeValueAsString(
                testService.getReviewTest(testId)
        );
        assertTrue(serialized.contains("our company's line of cheeses"));
    }

    @Test
    void listsLegacyTestsAsApprovedForBackwardCompatibility() throws Exception {
        TestDao testDao = mock(TestDao.class);
        ObjectMapper objectMapper = new ObjectMapper();
        com.toeic.model.Test legacyTest = new com.toeic.model.Test();
        legacyTest.setTestId("legacy-test");
        legacyTest.setTitle("Legacy test");
        when(testDao.findAllMetadata()).thenReturn(List.of(legacyTest));

        TestService service = new TestService(testDao, objectMapper);
        List<Map<String, Object>> result = service.listPublishedTests();

        assertEquals(1, result.size());
        assertEquals("APPROVED", result.getFirst().get("status"));
    }
}
