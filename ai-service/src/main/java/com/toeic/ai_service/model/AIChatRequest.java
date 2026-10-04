package com.toeic.ai_service.model;

import java.util.List;

public record AIChatRequest(
        String userId,
        String conversationId,
        String jobId,
        String userMessageId,
        String assistantMessageId,
        String locale,
        List<HistoryMessage> history,
        String currentMessage,
        QuestionContext questionContext
) {
    public AIChatRequest {
        history = history == null ? List.of() : List.copyOf(history);
    }

    public record HistoryMessage(String role, String content) {
    }

    public record QuestionContext(
            int partNumber,
            int questionNumber,
            String prompt,
            List<Option> options,
            String correctAnswer,
            String selectedAnswer,
            String detailedExplanation,
            String questionTranslation,
            String answerTranslation,
            String transcript,
            String transcriptTranslation
    ) {
        public QuestionContext {
            options = options == null ? List.of() : List.copyOf(options);
        }
    }

    public record Option(String label, String content) {
    }
}
