package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptResult {
    private String attemptId;
    private String testId;
    private String type;
    private String mode;
    private Integer selectedPart;
    private List<Integer> selectedParts;
    private Integer timeLimitSeconds;
    private Integer firstQuestionNumber;
    private Integer lastQuestionNumber;
    private Integer listeningTotalQuestions;
    private Integer readingTotalQuestions;
    private Integer listeningCorrect;
    private Integer listeningWrong;
    private Integer listeningUnanswered;
    private Integer readingCorrect;
    private Integer readingWrong;
    private Integer readingUnanswered;
    private Integer totalCorrect;
    private Integer totalWrong;
    private Integer totalUnanswered;
    private Integer totalQuestions;
    private Integer correctCount;
    private Integer incorrectCount;
    private Integer unansweredCount;
    private Integer listeningScore;
    private Integer readingScore;
    private Integer totalScore;
    private Integer estimatedTotalScore;
    private Long durationSeconds;
    private Long submittedAt;
    private Boolean autoSubmitted;
}
