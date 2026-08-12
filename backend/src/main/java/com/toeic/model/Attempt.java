package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class Attempt {
    private String id;
    private String userId;
    private String testId;
    private String status;

    private Long startedAt;
    private Long submittedAt;

    private Integer score;

    private Map<String, String> answers;

}
