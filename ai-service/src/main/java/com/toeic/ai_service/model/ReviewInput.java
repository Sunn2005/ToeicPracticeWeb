package com.toeic.ai_service.model;

import java.util.List;
import java.util.Map;

public record ReviewInput(
        String attemptId,
        String userId,
        String testId,
        Map<String, Object> attemptResult,
        List<ReviewQuestion> questions
) {
}
