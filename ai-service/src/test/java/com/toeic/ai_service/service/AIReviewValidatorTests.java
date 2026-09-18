package com.toeic.ai_service.service;

import com.toeic.ai_service.model.GeminiAnalysis;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewQuestion;
import com.toeic.ai_service.model.ReviewStatistics;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AIReviewValidatorTests {

    @Test
    void acceptsVietnameseNarrativeWithToeicTermsAndRejectsEnglishExplanation() {
        assertTrue(AIReviewValidator.isAcceptableVietnameseText(
                "Bạn nhận diện tốt bối cảnh trong Part 1 và nên tiếp tục luyện nghe các chi tiết mô tả hành động.",
                15
        ));
        assertFalse(AIReviewValidator.isAcceptableVietnameseText(
                "You are good at identifying photo scenes but need more practice with details.",
                8
        ));
        assertFalse(AIReviewValidator.isAcceptableVietnameseText(
                "Nhận diện Part 1 tốt.",
                8
        ));
        assertTrue(AIReviewValidator.isAcceptableEnglishText(
                "You identify photo details accurately and should continue practicing action descriptions in Part 1.",
                12
        ));
        assertFalse(AIReviewValidator.isAcceptableEnglishText(
                "Bạn nhận diện bối cảnh tốt nhưng cần luyện thêm các chi tiết mô tả hành động.",
                10
        ));
        assertTrue(AIReviewValidator.isAcceptableVietnameseText("Luyện nghe", 2));
        assertTrue(AIReviewValidator.isAcceptableVietnameseText(
                "Tăng độ chính xác khi nghe",
                5
        ));
    }

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

    @Test
    void acceptsOneWordLabelsButRejectsBlankLabels() {
        AIReviewValidator validator = new AIReviewValidator();
        ReviewInput input = validationInput();
        ReviewStatistics statistics = validationStatistics();

        assertDoesNotThrow(() -> validator.validate(
                validShortLabelAnalysis(List.of("Prepositions")),
                input,
                statistics,
                "en"
        ));

        assertThrows(AIReviewValidator.InvalidAIAnalysisException.class,
                () -> validator.validate(
                        validShortLabelAnalysis(List.of(" ")),
                        input,
                        statistics,
                        "en"
                ));
    }

    private ReviewInput validationInput() {
        List<ReviewQuestion> questions = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(part -> new ReviewQuestion(
                        part, part, "DETAIL", List.of("LISTENING"), List.of(), "EASY",
                        "A", "A", true, false, null, "Question", Map.of("A", "Answer"),
                        "Context", "Explanation"
                ))
                .toList();
        return new ReviewInput("attempt", "user", "test", Map.of(), questions);
    }

    private ReviewStatistics validationStatistics() {
        ReviewStatistics.Metric singleQuestionMetric = new ReviewStatistics.Metric(
                1, 1, 0, 0, 100, List.of(), "LOW"
        );
        Map<String, ReviewStatistics.Metric> byPart = new LinkedHashMap<>();
        java.util.stream.IntStream.rangeClosed(1, 7)
                .forEach(part -> byPart.put(String.valueOf(part), singleQuestionMetric));
        ReviewStatistics.Metric allQuestionsMetric = new ReviewStatistics.Metric(
                7, 7, 0, 0, 100, List.of(), "HIGH"
        );
        return new ReviewStatistics(
                50, 50, 100, 7, 0, 0,
                byPart,
                Map.of("DETAIL", allQuestionsMetric),
                Map.of("LISTENING", allQuestionsMetric),
                Map.of(),
                Map.of("EASY", allQuestionsMetric),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );
    }

    private GeminiAnalysis validShortLabelAnalysis(List<String> topicsToReview) {
        List<GeminiAnalysis.PartAnalysis> parts = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(part -> new GeminiAnalysis.PartAnalysis(
                        part,
                        100,
                        "STRONG",
                        "You consistently answer this part accurately and should continue practicing varied questions to preserve reliable performance under realistic test conditions.",
                        List.of("DETAIL"),
                        List.of()
                ))
                .toList();
        List<GeminiAnalysis.PriorityTopic> priorities = java.util.stream.IntStream.rangeClosed(1, 3)
                .mapToObj(priority -> new GeminiAnalysis.PriorityTopic(
                        priority,
                        "Vocabulary",
                        "DETAIL",
                        priority,
                        "You should review this area because consistent practice will improve accuracy across similar TOEIC questions.",
                        "Fluency"
                ))
                .toList();
        List<GeminiAnalysis.StudyDay> studyPlan = java.util.stream.IntStream.rangeClosed(1, 7)
                .mapToObj(day -> new GeminiAnalysis.StudyDay(
                        day,
                        "Review",
                        20,
                        List.of(new GeminiAnalysis.StudyTask(
                                "PRACTICE", "Drills", 20, day, "DETAIL", 10, 80
                        ))
                ))
                .toList();

        return new GeminiAnalysis(
                new GeminiAnalysis.Summary(
                        "Progress",
                        "You demonstrate reliable accuracy across the test and should keep reviewing detailed questions while practicing varied formats to strengthen consistency, confidence, and overall TOEIC performance.",
                        100,
                        null,
                        null
                ),
                List.of(),
                List.of(),
                parts,
                List.of(new GeminiAnalysis.KnowledgeGap(
                        "VOCABULARY",
                        "Vocabulary",
                        "DETAIL",
                        1,
                        100,
                        90,
                        "You should review focused vocabulary patterns to answer detailed questions more confidently and consistently.",
                        topicsToReview
                )),
                new GeminiAnalysis.TimeManagement(false, "INSUFFICIENT_DATA", "Unavailable", List.of()),
                priorities,
                studyPlan,
                List.of(new GeminiAnalysis.NextAction(
                        "Practice", "PRACTICE", 1, "DETAIL", List.of(1)
                )),
                "HIGH",
                List.of("Timing")
        );
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
