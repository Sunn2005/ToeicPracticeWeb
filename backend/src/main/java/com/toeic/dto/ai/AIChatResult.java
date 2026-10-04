package com.toeic.dto.ai;

public record AIChatResult(
        String userId,
        String conversationId,
        String jobId,
        String assistantMessageId,
        Status status,
        String answer,
        String errorCode
) {
    public enum Status { SUCCEEDED, FAILED }
}
