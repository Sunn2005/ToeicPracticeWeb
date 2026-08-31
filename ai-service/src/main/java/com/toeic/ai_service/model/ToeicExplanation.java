package com.toeic.ai_service.model;

public record ToeicExplanation(
        String explanation,
        String grammarPoint,
        String correctAnswer
) {
}