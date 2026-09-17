package com.toeic.service;

/**
 * Converts a section's correct-answer count to the demo TOEIC scale supplied
 * for this project. Partial-section attempts are normalized to an equivalent
 * number of correct answers out of 100 before applying the same scale.
 */
public final class ToeicScoreConverter {

    private static final int MAX_SECTION_SCORE = 495;

    private ToeicScoreConverter() {
    }

    public static int listeningScore(int correctAnswers, int totalQuestions) {
        if (totalQuestions <= 0) {
            return 0;
        }

        int equivalentCorrect = equivalentCorrectOutOfOneHundred(correctAnswers, totalQuestions);
        return Math.min(MAX_SECTION_SCORE, Math.max(15, 10 + equivalentCorrect * 5));
    }

    public static int readingScore(int correctAnswers, int totalQuestions) {
        if (totalQuestions <= 0) {
            return 0;
        }

        int equivalentCorrect = equivalentCorrectOutOfOneHundred(correctAnswers, totalQuestions);
        return Math.min(MAX_SECTION_SCORE, Math.max(10, equivalentCorrect * 5 - 5));
    }

    private static int equivalentCorrectOutOfOneHundred(int correctAnswers, int totalQuestions) {
        int boundedCorrect = Math.max(0, Math.min(totalQuestions, correctAnswers));
        return (int) Math.round(boundedCorrect * 100.0 / totalQuestions);
    }
}
