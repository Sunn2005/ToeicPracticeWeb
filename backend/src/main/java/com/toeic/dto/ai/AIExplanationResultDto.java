package com.toeic.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIExplanationResultDto {
    private String explanation;
    private String grammarPoint;
    private String correctAnswer;

    public static AIExplanationResultDto from(com.toeic.model.AIExplanationResult result) {
        if (result == null) {
            return null;
        }
        return new AIExplanationResultDto(
                result.getExplanation(),
                result.getGrammarPoint(),
                result.getCorrectAnswer()
        );
    }
}
