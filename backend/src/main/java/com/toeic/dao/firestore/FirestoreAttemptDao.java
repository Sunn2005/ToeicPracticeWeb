package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.toeic.dao.AttemptDao;
import com.toeic.model.Attempt;
import com.toeic.model.AttemptAnswer;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
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

        Attempt attempt = snapshot.toObject(Attempt.class);
        if (attempt == null) {
            return Optional.empty();
        }
        if (attempt.getId() == null) {
            attempt.setId(snapshot.getId());
        }
        return Optional.of(attempt);
    }

    @Override
    public List<Attempt> findByUserId(String userId) throws Exception {
        List<Attempt> attempts = new ArrayList<>();
        for (QueryDocumentSnapshot snapshot : firestore.collection("attempts")
                .whereEqualTo("userId", userId)
                .get()
                .get()
                .getDocuments()) {
            Attempt attempt = snapshot.toObject(Attempt.class);
            if (attempt.getId() == null) {
                attempt.setId(snapshot.getId());
            }
            attempts.add(attempt);
        }
        return attempts;
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
}
