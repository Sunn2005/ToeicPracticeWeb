package com.toeic.model;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AIChatConversation {
    public enum Status { ACTIVE, DELETED }

    private String id;
    private String userId;
    private String title;
    private String locale;
    private String contextAttemptId;
    private Integer contextQuestionNumber;
    private Status status;
    private Long createdAt;
    private Long updatedAt;
    private Long lastMessageAt;
}
