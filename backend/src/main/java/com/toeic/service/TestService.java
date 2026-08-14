package com.toeic.service;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class TestService {

    private final Firestore firestore;

    public TestService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Map<String, Object> getMetadata(String testId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("tests").document(testId).get().get();
        if (!snapshot.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi");
        }

        Map<String, Object> data = new LinkedHashMap<>(snapshot.getData());
        data.put("testId", testId);
        data.putIfAbsent("type", "FULL_TEST");
        data.putIfAbsent("listeningMinutes", 45);
        data.putIfAbsent("readingMinutes", 75);
        data.putIfAbsent("totalMinutes", 120);
        return data;
    }

    public Map<String, Object> getExamTest(String testId) throws Exception {
        return loadTest(testId, true);
    }

    public Map<String, Object> getReviewTest(String testId) throws Exception {
        return loadTest(testId, false);
    }

    public Map<Integer, String> getAnswerKey(String testId) throws Exception {
        Map<String, Object> test = getReviewTest(testId);
        Map<Integer, String> answerKey = new LinkedHashMap<>();
        collectAnswerKey(test, answerKey);
        return answerKey;
    }

    public Map<String, Object> addReviewAnswers(
            Map<String, Object> fullTest,
            Map<Integer, String> selectedAnswers
    ) {
        Object annotated = annotateReview(fullTest, selectedAnswers);
        return castMap(annotated);
    }

    private Map<String, Object> loadTest(String testId, boolean examSafe) throws Exception {
        Map<String, Object> test = new LinkedHashMap<>(getMetadata(testId));
        List<Map<String, Object>> parts = new ArrayList<>();

        for (int partNumber = 1; partNumber <= 7; partNumber++) {
            DocumentSnapshot partSnapshot = firestore
                    .collection("tests")
                    .document(testId)
                    .collection("parts")
                    .document("part" + partNumber)
                    .get()
                    .get();

            if (!partSnapshot.exists()) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Đề thi thiếu dữ liệu Part " + partNumber
                );
            }

            Object copied = deepCopy(partSnapshot.getData(), examSafe);
            if (examSafe && partNumber <= 2) {
                removeListeningOptionText(copied);
            }
            parts.add(castMap(copied));
        }

        test.put("parts", parts);
        return test;
    }

    private Object deepCopy(Object value, boolean examSafe) {
        if (value instanceof Map<?, ?> source) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : source.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (examSafe && ("correctAnswer".equals(key)
                        || "explanation".equals(key)
                        || "transcript".equals(key))) {
                    continue;
                }
                copy.put(key, deepCopy(entry.getValue(), examSafe));
            }
            return copy;
        }

        if (value instanceof List<?> source) {
            List<Object> copy = new ArrayList<>();
            for (Object item : source) {
                copy.add(deepCopy(item, examSafe));
            }
            return copy;
        }

        return value;
    }

    private void removeListeningOptionText(Object value) {
        if (value instanceof Map<?, ?> map) {
            Object answers = map.get("answers");
            if (answers instanceof List<?> options) {
                for (Object option : options) {
                    if (option instanceof Map<?, ?> answer) {
                        answer.remove("content");
                    }
                }
            }
            for (Object child : map.values()) {
                removeListeningOptionText(child);
            }
        } else if (value instanceof List<?> list) {
            for (Object child : list) {
                removeListeningOptionText(child);
            }
        }
    }

    private void collectAnswerKey(Object value, Map<Integer, String> answerKey) {
        if (value instanceof Map<?, ?> map) {
            Object questionNumber = map.get("questionNumber");
            Object correctAnswer = map.get("correctAnswer");
            if (questionNumber instanceof Number number && correctAnswer instanceof String answer) {
                answerKey.put(number.intValue(), answer);
            }
            for (Object child : map.values()) {
                collectAnswerKey(child, answerKey);
            }
        } else if (value instanceof List<?> list) {
            for (Object child : list) {
                collectAnswerKey(child, answerKey);
            }
        }
    }

    private Object annotateReview(Object value, Map<Integer, String> selectedAnswers) {
        if (value instanceof Map<?, ?> source) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : source.entrySet()) {
                copy.put(String.valueOf(entry.getKey()), annotateReview(entry.getValue(), selectedAnswers));
            }

            Object questionNumber = source.get("questionNumber");
            Object correctAnswer = source.get("correctAnswer");
            if (questionNumber instanceof Number number && correctAnswer instanceof String correct) {
                String selected = selectedAnswers.get(number.intValue());
                copy.put("selectedAnswer", selected);
                copy.put("answerStatus", selected == null
                        ? "UNANSWERED"
                        : correct.equalsIgnoreCase(selected) ? "CORRECT" : "INCORRECT");
            }
            return copy;
        }

        if (value instanceof List<?> source) {
            List<Object> copy = new ArrayList<>();
            for (Object item : source) {
                copy.add(annotateReview(item, selectedAnswers));
            }
            return copy;
        }

        return value;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }
}
