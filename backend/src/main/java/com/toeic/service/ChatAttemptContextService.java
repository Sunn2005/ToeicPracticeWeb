package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dto.ai.AIChatQuestionContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ChatAttemptContextService {
    private final AttemptService attemptService;

    public ChatAttemptContextService(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    public AIChatQuestionContext resolve(String userId, String attemptId, Integer questionNumber) throws Exception {
        if (attemptId == null || attemptId.isBlank()
                || questionNumber == null || questionNumber < 1 || questionNumber > 200) {
            throw notFound();
        }

        Map<String, Object> review;
        try {
            // Reuse ownership, deadline reconciliation, completion gating and canonical review normalization.
            review = attemptService.getReview(userId, attemptId);
        } catch (ResponseStatusException exception) {
            if (exception.getStatusCode().value() == 403 || exception.getStatusCode().value() == 404) {
                throw notFound();
            }
            if (exception.getStatusCode().value() == 409) {
                throw new ApiCodeException(HttpStatus.CONFLICT, "ATTEMPT_NOT_COMPLETED",
                        "Bài làm chưa cho phép xem lại câu hỏi");
            }
            throw exception;
        }

        int partNumber = partForQuestion(questionNumber);
        if (review.get("attempt") instanceof Map<?, ?> attempt
                && attempt.get("selectedParts") instanceof List<?> selectedParts
                && selectedParts.contains(partNumber)
                && review.get("test") instanceof Map<?, ?> test) {
            for (Object item : list(test.get("parts"))) {
                if (item instanceof Map<?, ?> part
                        && part.get("partNumber") instanceof Number number
                        && number.intValue() == partNumber) {
                    AIChatQuestionContext context = findQuestion(part, partNumber, questionNumber, null, null);
                    if (context != null) {
                        return context;
                    }
                }
            }
        }
        throw notFound();
    }

    private AIChatQuestionContext findQuestion(
            Map<?, ?> container, int partNumber, int questionNumber,
            String inheritedTranscript, String inheritedTranslation
    ) {
        String transcript = text(container.get("transcript"));
        String transcriptTranslation = text(container.get("transcriptTranslation"));
        if (transcript == null) transcript = inheritedTranscript;
        if (transcriptTranslation == null) transcriptTranslation = inheritedTranslation;
        for (Object item : list(container.get("questions"))) {
            if (item instanceof Map<?, ?> question
                    && question.get("questionNumber") instanceof Number number
                    && number.intValue() == questionNumber) {
                String questionTranscript = text(question.get("transcript"));
                return new AIChatQuestionContext(
                        partNumber, questionNumber, text(question.get("question")), options(question),
                        text(question.get("correctAnswer")), text(question.get("selectedAnswer")),
                        text(question.get("detailedExplanation")), text(question.get("questionTranslation")),
                        text(question.get("answerTranslation")),
                        questionTranscript == null ? transcript : questionTranscript,
                        transcriptTranslation
                );
            }
        }
        // Visit only known question containers, never arbitrary metadata or sibling fields.
        for (String key : List.of("groups", "passages", "passageGroups")) {
            for (Object item : list(container.get(key))) {
                if (item instanceof Map<?, ?> child) {
                    AIChatQuestionContext context = findQuestion(
                            child, partNumber, questionNumber, transcript, transcriptTranslation
                    );
                    if (context != null) return context;
                }
            }
        }
        return null;
    }

    private List<AIChatQuestionContext.Option> options(Map<?, ?> question) {
        List<AIChatQuestionContext.Option> options = new ArrayList<>();
        for (Object item : list(question.get("answers"))) {
            if (item instanceof Map<?, ?> option) {
                options.add(new AIChatQuestionContext.Option(text(option.get("label")), text(option.get("content"))));
            }
        }
        return options;
    }

    private List<?> list(Object value) {
        return value instanceof List<?> items ? items : List.of();
    }

    private String text(Object value) {
        return value instanceof String string ? string : null;
    }

    private int partForQuestion(int number) {
        if (number <= 6) return 1;
        if (number <= 31) return 2;
        if (number <= 70) return 3;
        if (number <= 100) return 4;
        if (number <= 130) return 5;
        if (number <= 146) return 6;
        return 7;
    }

    private ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy ngữ cảnh câu hỏi");
    }
}
