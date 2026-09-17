package com.toeic.ai_service.service;

import com.toeic.ai_service.model.GeminiAnalysis;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewQuestion;
import com.toeic.ai_service.model.ReviewStatistics;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;

class AIReviewValidatorTests {

    @Test
    void rejectsInventedScoreAndHighConfidenceForSmallSample() {
        AIReviewValidator validator = new AIReviewValidator();
        ReviewQuestion question = new ReviewQuestion(
                1, 1, "DETAIL", List.of("LISTENING"), List.of(), "EASY",
                "A", "A", true, false, null, "Q", Map.of("A", "A"), "C", "E"
        );
        ReviewInput input = new ReviewInput("a", "u", "t", Map.of(), List.of(question));
        ReviewStatistics stats = new ReviewStatistics(
                5, 5, 10, 1, 0, 0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );

        GeminiAnalysis invalid = analysis(999, "HIGH");
        assertThrows(AIReviewValidator.InvalidAIAnalysisException.class,
                () -> validator.validate(invalid, input, stats));

        GeminiAnalysis invalidConfidence = analysis(10, "HIGH");
        assertThrows(AIReviewValidator.InvalidAIAnalysisException.class,
                () -> validator.validate(invalidConfidence, input, stats));
    }

    private GeminiAnalysis analysis(int score, String confidence) {
        GeminiAnalysis.Evidence evidence = new GeminiAnalysis.Evidence(
                1, 1, 100, List.of(1), List.of()
        );
        return new GeminiAnalysis(
                new GeminiAnalysis.Summary("H", "C", score, null, null),
                List.of(new GeminiAnalysis.Strength("T", "SKILL", 1, "DETAIL", "M", evidence, confidence)),
                List.of(),
                List.of(new GeminiAnalysis.PartAnalysis(1, 100, "STRONG", "S", List.of("DETAIL"), List.of())),
                List.of(),
                new GeminiAnalysis.TimeManagement(false, "INSUFFICIENT_DATA", "Không đủ dữ liệu", List.of()),
                List.of(),
                java.util.stream.IntStream.rangeClosed(1, 7)
                        .mapToObj(day -> new GeminiAnalysis.StudyDay(day, "D", 10, List.of()))
                        .toList(),
                List.of(),
                "LOW",
                List.of("Một bài thi")
        );
    }
}
