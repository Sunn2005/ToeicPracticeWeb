package com.toeic.model;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AIChatMessage {
    public enum Role { USER, ASSISTANT }
    public enum Status { PENDING, SUCCEEDED, FAILED }

    private String id;
    private Role role;
    private String content;
    private Status status;
    private String jobId;
    private String errorCode;
    private Long createdAt;
    private Long completedAt;
}
