package com.toeic.dto.ai;

public record AIReviewCompleted(
        String attemptId,
        String userId,
        String analysisId,
        String status
) {
}
