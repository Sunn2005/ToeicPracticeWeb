package com.toeic.ai_service.model;

public record AIReviewFailed(
        String attemptId,
        String userId,
        String status,
        String errorCode
) {
}
