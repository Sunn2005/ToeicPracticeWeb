package com.toeic.dto;

public record SendChatMessageRequest(
        String content,
        String idempotencyKey
) {
}
