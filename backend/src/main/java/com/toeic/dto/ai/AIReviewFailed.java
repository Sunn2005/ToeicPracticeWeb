package com.toeic.dto.ai;

public record AIReviewFailed(
        String attemptId,
        String userId,
        String status,
        String errorCode
) {
}
