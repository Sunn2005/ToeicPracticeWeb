package com.toeic.model;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AIChatJob {
    public enum Status { PENDING, SUCCEEDED, FAILED }

    private String id;
    private String userId;
    private String conversationId;
    private String userMessageId;
    private String assistantMessageId;
    private String idempotencyKey;
    private Status status;
    private String errorCode;
    private Long createdAt;
    private Long updatedAt;
    private Long completedAt;
}
