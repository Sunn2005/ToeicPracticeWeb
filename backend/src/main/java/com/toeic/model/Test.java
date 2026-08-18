package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.toeic.model.enums.TestStatus;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class Test {

    private String testId;
    private String title;
    private String description;
    private Integer totalQuestions;
    private String type;
    private Integer listeningMinutes;
    private Integer readingMinutes;
    private Integer totalMinutes;
    private List<TestPart> parts;
    private TestStatus status;
    private String createdBy;
    private Long createdAt;
    private Long updatedAt;
    private Long submittedAt;
    private String reviewedBy;
    private Long reviewedAt;
    private String rejectionReason;

    public Optional<TestPart> findPart(int partNumber) {
        if (parts == null) {
            return Optional.empty();
        }
        return parts.stream()
                .filter(part -> part.getPartNumber() != null && part.getPartNumber() == partNumber)
                .findFirst();
    }

    public Map<Integer, String> answerKey() {
        Map<Integer, String> answerKey = new LinkedHashMap<>();
        if (parts == null) {
            return answerKey;
        }
        for (TestPart part : parts) {
            for (Question question : part.allQuestions()) {
                if (question.getQuestionNumber() != null && question.getCorrectAnswer() != null) {
                    answerKey.put(question.getQuestionNumber(), question.getCorrectAnswer());
                }
            }
        }
        return answerKey;
    }
}
