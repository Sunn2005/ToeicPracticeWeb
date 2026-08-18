package com.toeic.service;

import com.toeic.dao.AttemptDao;
import com.toeic.model.Attempt;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class UserLearningService {

    private static final long DAY_MS = 24L * 60L * 60L * 1000L;

    private final AttemptDao attemptDao;

    public UserLearningService(AttemptDao attemptDao) {
        this.attemptDao = attemptDao;
    }

    public List<Map<String, Object>> getAttempts(String userId) throws Exception {
        List<Attempt> attempts = new ArrayList<>(attemptDao.findByUserId(userId));
        attempts.sort(Comparator.comparing(
                Attempt::getStartedAt,
                Comparator.nullsLast(Comparator.reverseOrder())
        ));
        return attempts.stream().map(this::toAttemptSummary).toList();
    }

    public Map<String, Object> getStatistics(String userId) throws Exception {
        List<Attempt> attempts = attemptDao.findByUserId(userId);
        List<Attempt> completed = attempts.stream()
                .filter(attempt -> "COMPLETED".equals(attempt.getStatus()))
                .toList();

        int totalScore = 0;
        int bestScore = 0;
        int listeningScore = 0;
        int readingScore = 0;
        int listeningSamples = 0;
        int readingSamples = 0;
        Set<Long> activeDays = new LinkedHashSet<>();

        for (Attempt attempt : completed) {
            int score = number(attempt.getScore());
            totalScore += score;
            bestScore = Math.max(bestScore, score);
            if (attempt.getSubmittedAt() != null) {
                activeDays.add(attempt.getSubmittedAt() / DAY_MS);
            }
            Map<String, Object> result = attempt.getResult();
            if (result != null && number(result.get("listeningTotalQuestions")) > 0) {
                listeningScore += number(result.get("listeningScore"));
                listeningSamples++;
            }
            if (result != null && number(result.get("readingTotalQuestions")) > 0) {
                readingScore += number(result.get("readingScore"));
                readingSamples++;
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalAttempts", attempts.size());
        response.put("completedAttempts", completed.size());
        response.put("inProgressAttempts", attempts.size() - completed.size());
        response.put("averageScore", average(totalScore, completed.size()));
        response.put("bestScore", bestScore);
        response.put("averageListeningScore", average(listeningScore, listeningSamples));
        response.put("averageReadingScore", average(readingScore, readingSamples));
        response.put("activeDays", activeDays.size());
        return response;
    }

    private Map<String, Object> toAttemptSummary(Attempt attempt) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", attempt.getId());
        response.put("testId", attempt.getTestId());
        response.put("mode", attempt.getMode());
        response.put("selectedPart", attempt.getSelectedPart());
        response.put("selectedParts", attempt.getSelectedParts());
        response.put("status", attempt.getStatus());
        response.put("currentSection", attempt.getCurrentSection());
        response.put("currentQuestionNumber", attempt.getCurrentQuestionNumber());
        response.put("totalQuestions", attempt.getTotalQuestions());
        response.put("score", attempt.getScore());
        response.put("startedAt", attempt.getStartedAt());
        response.put("updatedAt", attempt.getUpdatedAt());
        response.put("submittedAt", attempt.getSubmittedAt());
        response.put("result", attempt.getResult());
        return response;
    }

    private int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private int average(int sum, int count) {
        return count == 0 ? 0 : Math.round((float) sum / count);
    }
}
