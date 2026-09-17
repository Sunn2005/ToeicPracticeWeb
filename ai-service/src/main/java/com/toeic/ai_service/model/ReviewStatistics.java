package com.toeic.ai_service.model;

import java.util.List;
import java.util.Map;

public record ReviewStatistics(
        int listeningScore,
        int readingScore,
        int totalScore,
        int correct,
        int wrong,
        int unanswered,
        Map<String, Metric> byPart,
        Map<String, Metric> byQuestionType,
        Map<String, Metric> bySkillTag,
        Map<String, Metric> byGrammarTag,
        Map<String, Metric> byDifficulty,
        TimeManagement timeManagement
) {
    public record Metric(
            int sampleSize,
            int correct,
            int wrong,
            int unanswered,
            double accuracy,
            List<Integer> wrongQuestionNumbers,
            String confidence
    ) {
    }

    public record TimeManagement(
            boolean available,
            Map<String, Integer> secondsByPart
    ) {
    }
}
