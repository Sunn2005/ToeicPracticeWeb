package com.toeic.dto.ai.chat;

public record SendChatMessageRequest(
        String content,
        String idempotencyKey
) {
}
