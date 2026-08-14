package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class AttemptAnswer {

    private Integer questionNumber;
    private String selectedAnswer;
    private Long answeredAt;
}
