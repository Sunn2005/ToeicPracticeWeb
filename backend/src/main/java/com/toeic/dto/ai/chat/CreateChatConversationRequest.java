package com.toeic.dto.ai.chat;

public record CreateChatConversationRequest(
        String locale,
        String attemptId,
        Integer questionNumber
) {
}
