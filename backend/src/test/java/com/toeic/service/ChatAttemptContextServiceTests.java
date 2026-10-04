package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.AttemptDao;
import com.toeic.dao.TestDao;
import com.toeic.dto.ai.AIChatQuestionContext;
import com.toeic.model.AnswerOption;
import com.toeic.model.Attempt;
import com.toeic.model.Passage;
import com.toeic.model.PassageGroup;
import com.toeic.model.Question;
import com.toeic.model.QuestionGroup;
import com.toeic.model.TestPart;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatAttemptContextServiceTests {
    private final AttemptDao attempts = mock(AttemptDao.class);
    private final TestDao tests = mock(TestDao.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final TestService testService = new TestService(tests, mapper);
    private final AttemptService attemptService = new AttemptService(attempts, testService);
    private final ChatAttemptContextService service = new ChatAttemptContextService(attemptService);

    @Test
    void resolvesOnlyPermittedFieldsFromOneOwnedCompletedQuestion() throws Exception {
        Attempt attempt = attempt(List.of(5));
        Question question = question(101);
        question.setQuestionTranslation("Câu hỏi");
        question.setAnswerTranslation("Đáp án");
        question.setDetailedExplanation("Lời giải");
        question.setTranscript("Question transcript");
        prepare(attempt, List.of(part(5, List.of(question, question(102)))));

        AIChatQuestionContext context = service.resolve("owner", "attempt", 101);

        assertEquals(5, context.partNumber());
        assertEquals(101, context.questionNumber());
        assertEquals("Prompt 101", context.prompt());
        assertEquals("A", context.correctAnswer());
        assertEquals("B", context.selectedAnswer());
        assertEquals("Câu hỏi", context.questionTranslation());
        assertEquals("Đáp án", context.answerTranslation());
        assertEquals("Lời giải", context.detailedExplanation());
        assertEquals("Question transcript", context.transcript());
        Map<String, Object> serialized = mapper.convertValue(context, new TypeReference<>() {});
        assertEquals(Set.of("partNumber", "questionNumber", "prompt", "options", "correctAnswer",
                "selectedAnswer", "questionTranslation", "answerTranslation", "detailedExplanation",
                "transcript", "transcriptTranslation"), serialized.keySet());
        assertEquals(List.of(Map.of("label", "A", "content", "Choice A"),
                Map.of("label", "B", "content", "Choice B")), serialized.get("options"));
        assertFalse(mapper.writeValueAsString(context).contains("Prompt 102"));
    }

    @Test
    void reusesCanonicalLegacyReviewNormalizationAndKeepsUnansweredNull() throws Exception {
        Question question = question(101);
        question.setTranslation(Map.of("question", "Câu hỏi cũ", "answer", "Đáp án cũ"));
        question.setExplanation("Lời giải cũ");
        prepare(attempt(List.of(5)), List.of(part(5, List.of(question))));
        when(attempts.findAnswers("attempt")).thenReturn(Map.of());

        AIChatQuestionContext context = service.resolve("owner", "attempt", 101);

        assertEquals("Câu hỏi cũ", context.questionTranslation());
        assertEquals("Đáp án cũ", context.answerTranslation());
        assertEquals("Lời giải cũ", context.detailedExplanation());
        assertNull(context.selectedAnswer());
    }

    @Test
    void selectsOneListeningQuestionAndOnlyItsGroupTranscript() throws Exception {
        TestPart part = part(3, null);
        QuestionGroup group = new QuestionGroup(1, "32-34", "audio", "image", "Shared script",
                "Bản dịch script", List.of(question(32), question(33), question(34)));
        QuestionGroup other = new QuestionGroup(2, "35-37", "other-audio", null, "Other script",
                "Other translation", List.of(question(35)));
        part.setGroups(List.of(group, other));
        prepare(attempt(List.of(3)), List.of(part));

        AIChatQuestionContext context = service.resolve("owner", "attempt", 33);

        assertEquals(3, context.partNumber());
        assertEquals("Prompt 33", context.prompt());
        assertEquals("Shared script", context.transcript());
        assertEquals("Bản dịch script", context.transcriptTranslation());
        assertFalse(mapper.writeValueAsString(context).contains("Other"));
        assertFalse(mapper.writeValueAsString(context).contains("Prompt 32"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"passage", "group", "nestedPassage"})
    void supportsReadingContainersWithoutCopyingPassageOrSiblingContent(String shape) throws Exception {
        TestPart part = part(7, null);
        Passage passage = new Passage(1, "Private title", "SINGLE", "EMAIL", "Passage body", "image",
                List.of(question(147), question(148)));
        if (shape.equals("passage")) part.setPassages(List.of(passage));
        else part.setPassageGroups(List.of(new PassageGroup(1, "147-148", "DOUBLE", List.of("image"),
                shape.equals("nestedPassage") ? List.of(passage) : null,
                shape.equals("group") ? List.of(question(147), question(148)) : null)));
        prepare(attempt(List.of(7)), List.of(part));

        AIChatQuestionContext context = service.resolve("owner", "attempt", 147);

        assertEquals(7, context.partNumber());
        assertEquals("Prompt 147", context.prompt());
        assertNull(context.transcript());
        String json = mapper.writeValueAsString(context);
        assertFalse(json.contains("Passage body"));
        assertFalse(json.contains("Prompt 148"));
    }

    @Test
    void hidesForeignAttemptExactlyLikeMissingAttemptBeforeLoadingReviewData() throws Exception {
        Attempt foreign = attempt(List.of(5));
        foreign.setUserId("other");
        foreign.setStatus("IN_PROGRESS");
        foreign.setSectionEndAt(System.currentTimeMillis() - 60_000L);
        when(attempts.findById("attempt")).thenReturn(Optional.of(foreign));
        when(attempts.findById("missing")).thenReturn(Optional.empty());

        ResponseStatusException hidden = assertThrows(ResponseStatusException.class,
                () -> service.resolve("owner", "attempt", 101));
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> service.resolve("owner", "missing", 101));

        assertEquals(HttpStatus.NOT_FOUND, hidden.getStatusCode());
        assertEquals(missing.getStatusCode(), hidden.getStatusCode());
        assertEquals(missing.getReason(), hidden.getReason());
        verifyNoInteractions(tests);
        verify(attempts, never()).findAnswers(anyString());
        verify(attempts, never()).save(any());
    }

    @Test
    void deniesIncompletePracticeEvenWhenItsQuestionWasAnswered() throws Exception {
        Attempt active = attempt(List.of(5));
        active.setType("PRACTICE");
        active.setStatus("IN_PROGRESS");
        active.setCurrentSection("READING");
        active.setTimed(false);
        when(attempts.findById("attempt")).thenReturn(Optional.of(active));
        when(attempts.findAnswers("attempt")).thenReturn(Map.of(101, "B"));

        ApiCodeException error = assertThrows(ApiCodeException.class,
                () -> service.resolve("owner", "attempt", 101));

        assertEquals(HttpStatus.CONFLICT, error.getStatus());
        assertEquals("ATTEMPT_NOT_COMPLETED", error.getCode());
        verifyNoInteractions(tests);
        verify(attempts, never()).findAnswers(anyString());
    }

    @Test
    void reconcilesElapsedContextAttemptBeforeExposingReviewFields() throws Exception {
        Attempt elapsed = attempt(List.of(5));
        elapsed.setStatus("IN_PROGRESS");
        elapsed.setCurrentSection("READING");
        elapsed.setSectionEndAt(System.currentTimeMillis() - 60_000L);
        List<TestPart> allParts = new ArrayList<>();
        int[][] ranges = {{1, 6}, {7, 31}, {32, 70}, {71, 100}, {101, 130}, {131, 146}, {147, 200}};
        for (int index = 0; index < ranges.length; index++) {
            List<Question> questions = new ArrayList<>();
            for (int number = ranges[index][0]; number <= ranges[index][1]; number++) questions.add(question(number));
            allParts.add(part(index + 1, questions));
        }
        prepare(elapsed, List.of(allParts.get(4)));
        when(tests.findParts("test", List.of(1, 2, 3, 4, 5, 6, 7))).thenReturn(allParts);

        AIChatQuestionContext context = service.resolve("owner", "attempt", 101);

        assertEquals("COMPLETED", elapsed.getStatus());
        assertTrue(elapsed.getResult().getAutoSubmitted());
        assertEquals("A", context.correctAnswer());
        verify(attempts).save(elapsed);
    }

    @Test
    void hidesMissingQuestionAndUnselectedPartWithinNoncontiguousScope() throws Exception {
        prepare(attempt(List.of(5, 7)), List.of(part(5, List.of(question(101))), part(7, List.of(question(147)))));
        for (int number : List.of(102, 131)) {
            ResponseStatusException error = assertThrows(ResponseStatusException.class,
                    () -> service.resolve("owner", "attempt", number));
            assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        }
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = {0, -1, 201})
    void hidesInvalidQuestionNumbers(Integer number) {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.resolve("owner", "attempt", number));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        verifyNoInteractions(tests);
    }

    private void prepare(Attempt attempt, List<TestPart> parts) throws Exception {
        when(attempts.findById("attempt")).thenReturn(Optional.of(attempt));
        when(attempts.findAnswers("attempt")).thenReturn(Map.of(101, "B"));
        com.toeic.model.Test metadata = new com.toeic.model.Test();
        metadata.setTestId("test");
        metadata.setUpdatedAt(1L);
        when(tests.findMetadataById("test")).thenReturn(Optional.of(metadata));
        when(tests.findParts("test", attempt.getSelectedParts())).thenReturn(parts);
    }

    private Attempt attempt(List<Integer> parts) {
        Attempt attempt = new Attempt();
        attempt.setId("attempt");
        attempt.setUserId("owner");
        attempt.setTestId("test");
        attempt.setType("FULL_TEST");
        attempt.setMode("PART");
        attempt.setSelectedParts(parts);
        attempt.setStatus("COMPLETED");
        attempt.setCurrentSection("FINISHED");
        attempt.setStartedAt(System.currentTimeMillis() - 120_000L);
        return attempt;
    }

    private TestPart part(int number, List<Question> questions) {
        return new TestPart(number, "Part " + number, questions, null, null, null);
    }

    private Question question(int number) {
        Question question = new Question();
        question.setQuestionNumber(number);
        question.setQuestion("Prompt " + number);
        question.setAnswers(List.of(new AnswerOption("A", "Choice A"), new AnswerOption("B", "Choice B")));
        question.setCorrectAnswer("A");
        question.setAudioUrl("private-audio");
        question.setImageUrl("private-image");
        question.setGrammarTopic("private-metadata");
        question.setSkillTags(List.of("private-tag"));
        return question;
    }
}
