package com.toeic.ai_service.model;

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

    public static AIChatResult succeeded(AIChatRequest request, String answer) {
        return new AIChatResult(request.userId(), request.conversationId(), request.jobId(),
                request.assistantMessageId(), Status.SUCCEEDED, answer, null);
    }

    public static AIChatResult failed(AIChatRequest request, String errorCode) {
        return new AIChatResult(request.userId(), request.conversationId(), request.jobId(),
                request.assistantMessageId(), Status.FAILED, null, errorCode);
    }
}
