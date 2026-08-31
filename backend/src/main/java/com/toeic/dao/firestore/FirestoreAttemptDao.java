package com.toeic.dao.firestore;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.WriteBatch;
import com.toeic.dao.AttemptDao;
import com.toeic.model.Attempt;
import com.toeic.model.AttemptAnswer;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class FirestoreAttemptDao implements AttemptDao {

    private final Firestore firestore;

    public FirestoreAttemptDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public String nextId() {
        return firestore.collection("attempts").document().getId();
    }

    @Override
    public void save(Attempt attempt) throws Exception {
        firestore.collection("attempts").document(attempt.getId()).set(attempt).get();
    }

    @Override
    public void updateTimestamp(String attemptId, long updatedAt) throws Exception {
        firestore.collection("attempts")
                .document(attemptId)
                .update("updatedAt", updatedAt)
                .get();
    }

    @Override
    public Optional<Attempt> findById(String attemptId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("attempts").document(attemptId).get().get();
        if (!snapshot.exists()) {
            return Optional.empty();
        }

        Map<String, Object> data = snapshot.getData();
        if (data == null) {
            return Optional.empty();
        }
        return Optional.of(attemptFrom(snapshot.getId(), data));
    }

    @Override
    public List<Attempt> findByUserId(String userId) throws Exception {
        List<Attempt> attempts = new ArrayList<>();
        for (QueryDocumentSnapshot snapshot : firestore.collection("attempts")
                .whereEqualTo("userId", userId)
                .get()
                .get()
                .getDocuments()) {
            Map<String, Object> data = snapshot.getData();
            if (data != null) {
                attempts.add(attemptFrom(snapshot.getId(), data));
            }
        }
        return attempts;
    }

    @Override
    public void delete(String attemptId) throws Exception {
        var attemptReference = firestore.collection("attempts").document(attemptId);
        WriteBatch batch = firestore.batch();
        for (QueryDocumentSnapshot answer : attemptReference
                .collection("answers")
                .get()
                .get()
                .getDocuments()) {
            batch.delete(answer.getReference());
        }
        batch.delete(attemptReference);
        batch.commit().get();
    }

    @Override
    public void saveAnswer(String attemptId, AttemptAnswer answer) throws Exception {
        firestore.collection("attempts")
                .document(attemptId)
                .collection("answers")
                .document(String.valueOf(answer.getQuestionNumber()))
                .set(answer)
                .get();
    }

    @Override
    public Map<Integer, String> findAnswers(String attemptId) throws Exception {
        Map<Integer, String> answers = new LinkedHashMap<>();
        for (QueryDocumentSnapshot snapshot : firestore.collection("attempts")
                .document(attemptId)
                .collection("answers")
                .get()
                .get()
                .getDocuments()) {
            AttemptAnswer answer = snapshot.toObject(AttemptAnswer.class);
            if (answer.getQuestionNumber() != null) {
                answers.put(answer.getQuestionNumber(), answer.getSelectedAnswer());
            }
        }
        return answers;
    }

    /**
     * Legacy Firestore documents can contain native Timestamp values while the
     * current API exposes epoch milliseconds. Mapping explicitly keeps old
     * attempts resumable and prevents one legacy document from breaking the
     * creation of every new attempt for that user.
     */
    static Attempt attemptFrom(String documentId, Map<String, Object> data) {
        Attempt attempt = new Attempt();
        String storedId = stringValue(data.get("id"));
        attempt.setId(storedId == null || storedId.isBlank() ? documentId : storedId);
        attempt.setUserId(stringValue(data.get("userId")));
        attempt.setTestId(stringValue(data.get("testId")));
        attempt.setType(stringValue(data.get("type")));
        attempt.setMode(stringValue(data.get("mode")));
        attempt.setSelectedPart(integerValue(data.get("selectedPart"), "selectedPart"));
        attempt.setSelectedParts(integerListValue(data.get("selectedParts"), "selectedParts"));
        attempt.setTimeLimitSeconds(integerValue(data.get("timeLimitSeconds"), "timeLimitSeconds"));
        attempt.setStatus(stringValue(data.get("status")));
        attempt.setCurrentSection(stringValue(data.get("currentSection")));
        attempt.setCurrentQuestionNumber(integerValue(
                data.get("currentQuestionNumber"),
                "currentQuestionNumber"
        ));
        attempt.setFirstQuestionNumber(integerValue(
                data.get("firstQuestionNumber"),
                "firstQuestionNumber"
        ));
        attempt.setLastQuestionNumber(integerValue(
                data.get("lastQuestionNumber"),
                "lastQuestionNumber"
        ));
        attempt.setTotalQuestions(integerValue(data.get("totalQuestions"), "totalQuestions"));
        attempt.setStartedAt(epochMillis(data.get("startedAt"), "startedAt"));
        attempt.setUpdatedAt(epochMillis(data.get("updatedAt"), "updatedAt"));
        attempt.setSubmittedAt(epochMillis(data.get("submittedAt"), "submittedAt"));
        attempt.setSectionStartedAt(epochMillis(data.get("sectionStartedAt"), "sectionStartedAt"));
        attempt.setSectionEndAt(epochMillis(data.get("sectionEndAt"), "sectionEndAt"));
        attempt.setOverallEndAt(epochMillis(data.get("overallEndAt"), "overallEndAt"));
        attempt.setListeningStartedAt(epochMillis(
                data.get("listeningStartedAt"),
                "listeningStartedAt"
        ));
        attempt.setListeningEndAt(epochMillis(data.get("listeningEndAt"), "listeningEndAt"));
        attempt.setReadingStartedAt(epochMillis(data.get("readingStartedAt"), "readingStartedAt"));
        attempt.setReadingEndAt(epochMillis(data.get("readingEndAt"), "readingEndAt"));
        attempt.setScore(integerValue(data.get("score"), "score"));
        attempt.setResult(objectMapValue(data.get("result"), "result"));
        attempt.setAnswers(stringMapValue(data.get("answers"), "answers"));
        return attempt;
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Integer integerValue(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw unsupportedFieldType(fieldName, value);
    }

    private static List<Integer> integerListValue(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof List<?> values) {
            List<Integer> result = new ArrayList<>();
            for (Object item : values) {
                result.add(integerValue(item, fieldName));
            }
            return result;
        }
        throw unsupportedFieldType(fieldName, value);
    }

    private static Long epochMillis(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.getSeconds() * 1_000L + timestamp.getNanos() / 1_000_000L;
        }
        if (value instanceof Date date) {
            return date.getTime();
        }
        throw unsupportedFieldType(fieldName, value);
    }

    private static Map<String, Object> objectMapValue(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof Map<?, ?> source) {
            Map<String, Object> result = new LinkedHashMap<>();
            source.forEach((key, item) -> result.put(String.valueOf(key), item));
            return result;
        }
        throw unsupportedFieldType(fieldName, value);
    }

    private static Map<String, String> stringMapValue(Object value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value instanceof Map<?, ?> source) {
            Map<String, String> result = new LinkedHashMap<>();
            source.forEach((key, item) -> result.put(
                    String.valueOf(key),
                    item == null ? null : String.valueOf(item)
            ));
            return result;
        }
        throw unsupportedFieldType(fieldName, value);
    }

    private static IllegalArgumentException unsupportedFieldType(String fieldName, Object value) {
        return new IllegalArgumentException(
                "Kiểu dữ liệu Firestore không hợp lệ cho " + fieldName + ": "
                        + value.getClass().getName()
        );
    }
}
