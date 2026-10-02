package com.toeic.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptResultDto {
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

    public static AttemptResultDto from(com.toeic.model.AttemptResult result) {
        if (result == null) {
            return null;
        }
        return AttemptResultDto.builder()
                .attemptId(result.getAttemptId())
                .testId(result.getTestId())
                .type(result.getType())
                .mode(result.getMode())
                .selectedPart(result.getSelectedPart())
                .selectedParts(result.getSelectedParts())
                .timeLimitSeconds(result.getTimeLimitSeconds())
                .firstQuestionNumber(result.getFirstQuestionNumber())
                .lastQuestionNumber(result.getLastQuestionNumber())
                .listeningTotalQuestions(result.getListeningTotalQuestions())
                .readingTotalQuestions(result.getReadingTotalQuestions())
                .listeningCorrect(result.getListeningCorrect())
                .listeningWrong(result.getListeningWrong())
                .listeningUnanswered(result.getListeningUnanswered())
                .readingCorrect(result.getReadingCorrect())
                .readingWrong(result.getReadingWrong())
                .readingUnanswered(result.getReadingUnanswered())
                .totalCorrect(result.getTotalCorrect())
                .totalWrong(result.getTotalWrong())
                .totalUnanswered(result.getTotalUnanswered())
                .totalQuestions(result.getTotalQuestions())
                .correctCount(result.getCorrectCount())
                .incorrectCount(result.getIncorrectCount())
                .unansweredCount(result.getUnansweredCount())
                .listeningScore(result.getListeningScore())
                .readingScore(result.getReadingScore())
                .totalScore(result.getTotalScore())
                .estimatedTotalScore(result.getEstimatedTotalScore())
                .durationSeconds(result.getDurationSeconds())
                .submittedAt(result.getSubmittedAt())
                .autoSubmitted(result.getAutoSubmitted())
                .build();
    }
}
