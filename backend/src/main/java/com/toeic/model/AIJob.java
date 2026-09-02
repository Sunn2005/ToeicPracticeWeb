package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

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

    private Map<String, Object> result;
    private String error;
}