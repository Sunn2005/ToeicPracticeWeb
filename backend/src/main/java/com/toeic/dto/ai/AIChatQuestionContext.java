package com.toeic.dto.ai;

import java.util.List;

/** Only reviewable fields from one owned, completed question may cross the AI boundary. */
public record AIChatQuestionContext(
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
    public AIChatQuestionContext {
        options = List.copyOf(options);
    }

    public record Option(String label, String content) {
    }
}
