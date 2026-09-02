package com.toeic.dto.ai;

public record AIJobResult(
        int schemaVersion,
        String jobId,
        String status,
        String completedAt,
        ToeicExplanation result,
        String error
) {
    public record ToeicExplanation(
            String explanation,
            String grammarPoint,
            String correctAnswer
    ) {
    }
}