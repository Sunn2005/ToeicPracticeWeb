package com.toeic.ai_service.service;

import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewQuestion;
import com.toeic.ai_service.model.ReviewStatistics;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ReviewStatisticsServiceTests {

    private final ReviewStatisticsService service = new ReviewStatisticsService();

    @Test
    void aggregatesByPartQuestionTypeSkillGrammarAndDifficulty() {
        ReviewInput input = new ReviewInput(
                "attempt-1",
                "user-1",
                "test-1",
                Map.of("listeningScore", 300, "readingScore", 250, "totalScore", 550),
                List.of(
                        question(1, 1, "PHOTO", List.of("DETAIL"), List.of(), "EASY", true, false),
                        question(2, 1, "PHOTO", List.of("DETAIL"), List.of(), "EASY", false, false),
                        question(101, 5, "WORD_FORM", List.of("GRAMMAR"), List.of("ADVERBS"), "MEDIUM", false, true)
                )
        );

        ReviewStatistics result = service.calculate(input);

        assertEquals(1, result.correct());
        assertEquals(1, result.wrong());
        assertEquals(1, result.unanswered());
        assertEquals(3, result.bySkillTag().get("DETAIL").sampleSize() + result.bySkillTag().get("GRAMMAR").sampleSize());
        assertEquals(List.of(2), result.bySkillTag().get("DETAIL").wrongQuestionNumbers());
        assertEquals(1, result.byGrammarTag().get("ADVERBS").sampleSize());
        assertEquals("LOW", result.byGrammarTag().get("ADVERBS").confidence());
        assertEquals(2, result.byDifficulty().get("EASY").sampleSize());
        assertFalse(result.timeManagement().available());
    }

    @Test
    void emptyGrammarTagsDoNotCreateAnEmptyBucket() {
        ReviewInput input = new ReviewInput(
                "attempt-1", "user-1", "test-1", Map.of(),
                List.of(question(1, 1, "DETAIL", List.of("LISTENING"), List.of(), "EASY", true, false))
        );

        assertEquals(Map.of(), service.calculate(input).byGrammarTag());
    }

    private ReviewQuestion question(
            int number,
            int part,
            String type,
            List<String> skills,
            List<String> grammar,
            String difficulty,
            boolean correct,
            boolean unanswered
    ) {
        return new ReviewQuestion(
                number, part, type, skills, grammar, difficulty,
                unanswered ? null : "A", "A", correct, unanswered, null,
                "Question", Map.of("A", "Answer"), "Context", "Explanation"
        );
    }
}
