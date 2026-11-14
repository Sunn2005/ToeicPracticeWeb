package com.toeic.model.ai.job;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIExplanationResult {
    private String explanation;
    private String grammarPoint;
    private String correctAnswer;
}
