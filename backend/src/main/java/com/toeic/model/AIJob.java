package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIJob {

    private String id;
    private String userId;
    private String taskType;
    private String status;

    private Long createdAt;
    private Long updatedAt;
    private Long completedAt;

    private AIExplanationResult result;
    private String error;
}
