package com.toeic.ai_service.model;

import java.util.List;

public record GeminiAnalysis(
        Summary summary,
        List<Strength> strengths,
        List<Weakness> weaknesses,
        List<PartAnalysis> partAnalysis,
        List<KnowledgeGap> knowledgeGaps,
        TimeManagement timeManagement,
        List<PriorityTopic> priorityTopics,
        List<StudyDay> studyPlan,
        List<NextAction> nextActions,
        String overallConfidence,
        List<String> limitations
) {
    public record Summary(
            String headline,
            String overallComment,
            Integer currentScore,
            Integer targetScore,
            Integer scoreGap
    ) {
    }

    public record Evidence(
            int correct,
            int total,
            double accuracy,
            List<Integer> questionNumbers,
            List<Integer> wrongQuestionNumbers
    ) {
    }

    public record Strength(
            String title,
            String category,
            Integer part,
            String tag,
            String message,
            Evidence evidence,
            String confidence
    ) {
    }

    public record Weakness(
            String title,
            String category,
            Integer part,
            String tag,
            String priority,
            String message,
            Evidence evidence,
            String recommendation,
            String confidence
    ) {
    }

    public record PartAnalysis(
            int part,
            double accuracy,
            String level,
            String summary,
            List<String> strongTags,
            List<String> weakTags
    ) {
    }

    public record KnowledgeGap(
            String category,
            String name,
            String tag,
            int priority,
            double currentAccuracy,
            double targetAccuracy,
            String explanation,
            List<String> topicsToReview
    ) {
    }

    public record TimeManagement(
            boolean available,
            String status,
            String summary,
            List<String> recommendations
    ) {
    }

    public record PriorityTopic(
            int priority,
            String title,
            String tag,
            Integer part,
            String reason,
            String goal
    ) {
    }

    public record StudyTask(
            String type,
            String title,
            int durationMinutes,
            Integer part,
            String skillTag,
            Integer targetQuestionCount,
            Integer targetAccuracy
    ) {
    }

    public record StudyDay(
            int day,
            String title,
            int estimatedMinutes,
            List<StudyTask> tasks
    ) {
    }

    public record NextAction(
            String label,
            String actionType,
            Integer part,
            String tag,
            List<Integer> questionNumbers
    ) {
    }
}
