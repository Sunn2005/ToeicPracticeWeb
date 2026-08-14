package com.toeic.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CreateAttemptRequest {
    private String testId;
    private String mode;
    private Integer part;

    public CreateAttemptRequest(String testId) {
        this.testId = testId;
    }
}
