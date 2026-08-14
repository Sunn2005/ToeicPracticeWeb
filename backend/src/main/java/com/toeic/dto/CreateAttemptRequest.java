package com.toeic.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CreateAttemptRequest {
    private String testId;
    private String mode;
    private Integer part;
    private List<Integer> parts;
    private Integer durationMinutes;

    public CreateAttemptRequest(String testId) {
        this.testId = testId;
    }

    public CreateAttemptRequest(String testId, String mode, Integer part) {
        this.testId = testId;
        this.mode = mode;
        this.part = part;
    }
}
