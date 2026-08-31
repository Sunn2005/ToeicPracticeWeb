package com.toeic.ai_service.model;

import java.time.Instant;

public record AIJobResult(
        int schemaVersion,
        String jobId,
        String status,
        String completedAt,
        ToeicExplanation result
) {
    public static AIJobResult success(
            String jobId,
            ToeicExplanation result
    ) {
        return new AIJobResult(
                1,
                jobId,
                "SUCCEEDED",
                Instant.now().toString(),
                result
        );
    }
}