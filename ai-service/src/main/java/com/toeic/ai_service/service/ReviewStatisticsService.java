package com.toeic.ai_service.service;

import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewQuestion;
import com.toeic.ai_service.model.ReviewStatistics;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;

@Service
public class ReviewStatisticsService {

    public ReviewStatistics calculate(ReviewInput input) {
        List<ReviewQuestion> questions = input.questions();
        int correct = (int) questions.stream().filter(ReviewQuestion::correct).count();
        int unanswered = (int) questions.stream().filter(ReviewQuestion::unanswered).count();
        int wrong = questions.size() - correct - unanswered;

        return new ReviewStatistics(
                number(input.attemptResult().get("listeningScore")),
                number(input.attemptResult().get("readingScore")),
                number(input.attemptResult().get("totalScore")),
                correct,
                wrong,
                unanswered,
                aggregate(questions, question -> List.of(String.valueOf(question.partNumber()))),
                aggregate(questions, question -> List.of(question.questionType())),
                aggregate(questions, ReviewQuestion::skillTags),
                aggregate(questions, ReviewQuestion::grammarTags),
                aggregate(questions, question -> List.of(question.difficulty())),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );
    }

    private Map<String, ReviewStatistics.Metric> aggregate(
            List<ReviewQuestion> questions,
            Function<ReviewQuestion, List<String>> classifier
    ) {
        Map<String, List<ReviewQuestion>> groups = new TreeMap<>();
        for (ReviewQuestion question : questions) {
            List<String> keys = classifier.apply(question);
            if (keys == null) {
                continue;
            }
            for (String key : keys) {
                if (key != null && !key.isBlank()) {
                    groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(question);
                }
            }
        }

        Map<String, ReviewStatistics.Metric> result = new LinkedHashMap<>();
        groups.forEach((key, values) -> {
            int sampleSize = values.size();
            int correct = (int) values.stream().filter(ReviewQuestion::correct).count();
            int unanswered = (int) values.stream().filter(ReviewQuestion::unanswered).count();
            int wrong = sampleSize - correct - unanswered;
            List<Integer> wrongQuestions = values.stream()
                    .filter(question -> !question.correct() && !question.unanswered())
                    .map(ReviewQuestion::questionNumber)
                    .sorted()
                    .toList();
            double accuracy = sampleSize == 0 ? 0 : round(correct * 100.0 / sampleSize);
            result.put(key, new ReviewStatistics.Metric(
                    sampleSize,
                    correct,
                    wrong,
                    unanswered,
                    accuracy,
                    wrongQuestions,
                    sampleSize < 3 ? "LOW" : sampleSize < 6 ? "MEDIUM" : "HIGH"
            ));
        });
        return result;
    }

    private int number(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
