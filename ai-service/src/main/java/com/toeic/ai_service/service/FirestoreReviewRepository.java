package com.toeic.ai_service.service;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.SetOptions;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewQuestion;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class FirestoreReviewRepository {

    private static final long PROCESSING_LEASE_MS = 15 * 60 * 1000L;
    private final Firestore firestore;

    public FirestoreReviewRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    public ClaimResult claim(String attemptId, String userId) throws Exception {
        return claim(attemptId, userId, false, false);
    }

    public ClaimResult claim(String attemptId, String userId, boolean redelivered) throws Exception {
        return claim(attemptId, userId, redelivered, false);
    }

    public ClaimResult claim(
            String attemptId,
            String userId,
            boolean redelivered,
            boolean refresh
    ) throws Exception {
        DocumentReference attemptReference = firestore.collection("attempts").document(attemptId);
        DocumentReference analysisReference = firestore.collection("aiAnalyses").document(attemptId);
        long now = System.currentTimeMillis();

        return firestore.runTransaction(transaction -> {
            DocumentSnapshot attempt = transaction.get(attemptReference).get();
            if (!attempt.exists() || !userId.equals(attempt.getString("userId"))) {
                throw new IllegalArgumentException("Attempt không tồn tại hoặc không thuộc người dùng");
            }
            DocumentSnapshot analysis = transaction.get(analysisReference).get();
            if (analysis.exists()) {
                String status = analysis.getString("status");
                Long startedAt = analysis.getLong("processingStartedAt");
                if ("COMPLETED".equals(status) && (!refresh || redelivered)) {
                    return ClaimResult.ALREADY_COMPLETED;
                }
                if (!redelivered && "PROCESSING".equals(status) && startedAt != null
                        && now - startedAt < PROCESSING_LEASE_MS) {
                    return ClaimResult.ALREADY_PROCESSING;
                }
            }

            Map<String, Object> document = new LinkedHashMap<>();
            document.put("analysisId", attemptId);
            document.put("attemptId", attemptId);
            document.put("userId", userId);
            document.put("status", "PROCESSING");
            document.put("requestedAt", epochOrNow(attempt.get("aiAnalysisRequestedAt"), now));
            document.put("processingStartedAt", now);
            document.put("completedAt", null);
            document.put("error", null);
            transaction.set(analysisReference, document, SetOptions.merge());
            transaction.update(attemptReference, Map.of(
                    "aiAnalysisStatus", "PROCESSING",
                    "updatedAt", now
            ));
            return ClaimResult.CLAIMED;
        }).get();
    }

    public enum ClaimResult {
        CLAIMED,
        ALREADY_PROCESSING,
        ALREADY_COMPLETED
    }

    public ReviewInput load(String attemptId, String userId) throws Exception {
        DocumentSnapshot attemptSnapshot = firestore.collection("attempts")
                .document(attemptId).get().get();
        if (!attemptSnapshot.exists() || attemptSnapshot.getData() == null) {
            throw new IllegalArgumentException("Attempt không tồn tại");
        }
        Map<String, Object> attempt = attemptSnapshot.getData();
        if (!userId.equals(string(attempt.get("userId")))) {
            throw new IllegalArgumentException("Attempt không thuộc người dùng");
        }
        if (!"FULL_TEST".equals(string(attempt.get("type")))
                || !"FULL".equals(string(attempt.get("mode")))
                || !"COMPLETED".equals(string(attempt.get("status")))) {
            throw new IllegalArgumentException("Attempt không phải Full Test đã hoàn thành");
        }

        String testId = requiredString(attempt.get("testId"), "testId");
        Map<Integer, String> selectedAnswers = new LinkedHashMap<>();
        for (QueryDocumentSnapshot answer : attemptSnapshot.getReference()
                .collection("answers").get().get().getDocuments()) {
            Map<String, Object> data = answer.getData();
            int number = integer(data.get("questionNumber"), "questionNumber");
            selectedAnswers.put(number, string(data.get("selectedAnswer")));
        }

        List<ReviewQuestion> questions = new ArrayList<>();
        DocumentReference testReference = firestore.collection("tests").document(testId);
        for (int partNumber = 1; partNumber <= 7; partNumber++) {
            DocumentSnapshot partSnapshot = testReference.collection("parts")
                    .document("part" + partNumber).get().get();
            if (!partSnapshot.exists() || partSnapshot.getData() == null) {
                throw new IllegalArgumentException("Đề thi thiếu Part " + partNumber);
            }
            extractPart(partNumber, partSnapshot.getData(), selectedAnswers, questions);
        }
        questions.sort(Comparator.comparingInt(ReviewQuestion::questionNumber));
        if (questions.size() != 200) {
            throw new IllegalArgumentException("Full Test phải có đúng 200 câu, hiện có " + questions.size());
        }

        return new ReviewInput(
                attemptId,
                userId,
                testId,
                objectMap(attempt.get("result")),
                List.copyOf(questions)
        );
    }

    public void saveCompleted(
            ReviewInput input,
            Map<String, Object> result,
            String model,
            String promptVersion,
            String schemaVersion,
            int retryCount
    ) throws Exception {
        long now = System.currentTimeMillis();
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("analysisId", input.attemptId());
        document.put("attemptId", input.attemptId());
        document.put("userId", input.userId());
        document.put("status", "COMPLETED");
        document.put("provider", "GEMINI");
        document.put("model", model);
        document.put("promptVersion", promptVersion);
        document.put("schemaVersion", schemaVersion);
        document.put("result", result);
        document.put("retryCount", retryCount);
        document.put("error", null);
        document.put("completedAt", now);
        document.put("completedAtIso", Instant.ofEpochMilli(now).toString());
        firestore.collection("aiAnalyses").document(input.attemptId())
                .set(document, SetOptions.merge()).get();
    }

    public void saveFailed(String attemptId, String userId, String errorCode, int retryCount) throws Exception {
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("analysisId", attemptId);
        document.put("attemptId", attemptId);
        document.put("userId", userId);
        document.put("status", "FAILED");
        document.put("retryCount", retryCount);
        document.put("error", errorCode);
        document.put("completedAt", System.currentTimeMillis());
        firestore.collection("aiAnalyses").document(attemptId)
                .set(document, SetOptions.merge()).get();
    }

    private void extractPart(
            int partNumber,
            Map<String, Object> part,
            Map<Integer, String> selectedAnswers,
            List<ReviewQuestion> target
    ) {
        addQuestions(partNumber, list(part.get("questions")), "", selectedAnswers, target);

        for (Map<String, Object> group : maps(part.get("groups"))) {
            addQuestions(
                    partNumber,
                    list(group.get("questions")),
                    string(group.get("transcript")),
                    selectedAnswers,
                    target
            );
        }
        for (Map<String, Object> passage : maps(part.get("passages"))) {
            addQuestions(
                    partNumber,
                    list(passage.get("questions")),
                    string(passage.get("content")),
                    selectedAnswers,
                    target
            );
        }
        for (Map<String, Object> group : maps(part.get("passageGroups"))) {
            String context = maps(group.get("passages")).stream()
                    .map(passage -> string(passage.get("content")))
                    .filter(value -> value != null && !value.isBlank())
                    .reduce((left, right) -> left + "\n\n" + right)
                    .orElse("");
            addQuestions(partNumber, list(group.get("questions")), context, selectedAnswers, target);
        }
    }

    private void addQuestions(
            int partNumber,
            List<?> rawQuestions,
            String parentContext,
            Map<Integer, String> selectedAnswers,
            List<ReviewQuestion> target
    ) {
        for (Object value : rawQuestions) {
            if (!(value instanceof Map<?, ?> raw)) {
                continue;
            }
            Map<String, Object> question = stringMap(raw);
            int number = integer(question.get("questionNumber"), "questionNumber");
            String correctAnswer = requiredString(question.get("correctAnswer"), "correctAnswer");
            String selectedAnswer = selectedAnswers.get(number);
            boolean unanswered = selectedAnswer == null || selectedAnswer.isBlank();
            String context = firstNonBlank(string(question.get("transcript")), parentContext);

            Map<String, String> answers = new LinkedHashMap<>();
            for (Map<String, Object> option : maps(question.get("answers"))) {
                answers.put(string(option.get("label")), string(option.get("content")));
            }

            target.add(new ReviewQuestion(
                    number,
                    partNumber,
                    requiredString(question.get("questionType"), "questionType"),
                    stringsRequired(question.get("skillTags"), "skillTags"),
                    stringsRequired(question.get("grammarTags"), "grammarTags"),
                    requiredString(question.get("difficulty"), "difficulty"),
                    selectedAnswer,
                    correctAnswer,
                    !unanswered && correctAnswer.equalsIgnoreCase(selectedAnswer),
                    unanswered,
                    null,
                    string(question.get("question")),
                    answers,
                    context,
                    firstNonBlank(
                            string(question.get("detailedExplanation")),
                            string(question.get("explanation"))
                    )
            ));
        }
    }

    private Object epochOrNow(Object value, long fallback) {
        return value instanceof Number ? value : fallback;
    }

    private String firstNonBlank(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private String requiredString(Object value, String field) {
        String result = string(value);
        if (result == null || result.isBlank()) {
            throw new IllegalArgumentException("Thiếu field " + field);
        }
        return result;
    }

    private String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private int integer(Object value, String field) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw new IllegalArgumentException("Field " + field + " không phải số");
    }

    private List<String> stringsRequired(Object value, String field) {
        if (!(value instanceof List<?> values)) {
            throw new IllegalArgumentException("Thiếu mảng " + field);
        }
        return values.stream().map(String::valueOf).toList();
    }

    private List<?> list(Object value) {
        return value instanceof List<?> values ? values : List.of();
    }

    private List<Map<String, Object>> maps(Object value) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list(value)) {
            if (item instanceof Map<?, ?> map) {
                result.add(stringMap(map));
            }
        }
        return result;
    }

    private Map<String, Object> objectMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return stringMap(map);
        }
        return Map.of();
    }

    private Map<String, Object> stringMap(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }
}
