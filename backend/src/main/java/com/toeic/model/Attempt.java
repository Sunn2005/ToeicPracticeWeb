package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class Attempt {
    private String id;
    private String userId;
    private String testId;
    private String type;
    private String mode;
    private Integer selectedPart;
    private List<Integer> selectedParts;
    private Integer timeLimitSeconds;
    private String status;
    private String currentSection;
    private Integer currentQuestionNumber;
    private Integer firstQuestionNumber;
    private Integer lastQuestionNumber;
    private Integer totalQuestions;

    private Long startedAt;
    private Long updatedAt;
    private Long submittedAt;
    private Long sectionStartedAt;
    private Long sectionEndAt;
    private Long overallEndAt;
    private Long listeningStartedAt;
    private Long listeningEndAt;
    private Long readingStartedAt;
    private Long readingEndAt;

    private Integer score;
    private Map<String, Object> result;

    // Giữ field này để đọc được các attempt Part 5 cũ. Full Test lưu đáp án
    // trong attempts/{attemptId}/answers/{questionNumber}.
    private Map<String, String> answers;

}
