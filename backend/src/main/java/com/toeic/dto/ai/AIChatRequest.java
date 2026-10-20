package com.toeic.dto.ai;

import java.util.List;

public record AIChatRequest(
        String userId,
        String conversationId,
        String jobId,
        String userMessageId,
        String assistantMessageId,
        String locale,
        List<HistoryMessage> history,
        String currentMessage,
        AIChatQuestionContext questionContext
) {
    public AIChatRequest {
        history = history == null ? List.of() : List.copyOf(history);
    }

    public record HistoryMessage(String role, String content) {
    }
}
