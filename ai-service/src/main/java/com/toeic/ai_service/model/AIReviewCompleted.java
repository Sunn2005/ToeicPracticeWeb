package com.toeic.ai_service.model;

public record AIReviewCompleted(
        String attemptId,
        String userId,
        String analysisId,
        String status
) {
}
