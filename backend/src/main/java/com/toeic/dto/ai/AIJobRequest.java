package com.toeic.dto.ai;

import java.util.Map;

public record AIJobRequest(
        int schemaVersion,
        String jobId,
        String taskType,
        String requestedAt,
        Payload payload
) {
    public record Payload(
            String question,
            Map<String, String> options,
            String correctAnswer,
            String userAnswer,
            String locale
    ) {
    }
}