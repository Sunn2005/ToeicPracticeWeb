package com.toeic.ai_service.model;

import java.util.List;
import java.util.Map;

public record ReviewQuestion(
        int questionNumber,
        int partNumber,
        String questionType,
        List<String> skillTags,
        List<String> grammarTags,
        String difficulty,
        String selectedAnswer,
        String correctAnswer,
        boolean correct,
        boolean unanswered,
        Integer timeSpentSeconds,
        String question,
        Map<String, String> answers,
        String context,
        String detailedExplanation
) {
}
