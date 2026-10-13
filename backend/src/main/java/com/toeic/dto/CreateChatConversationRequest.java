package com.toeic.dto;

public record CreateChatConversationRequest(
        String locale,
        String attemptId,
        Integer questionNumber
) {
}
