package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.dao.AIAnalysisDao;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Repository
public class FirestoreAIAnalysisDao implements AIAnalysisDao {

    private final Firestore firestore;

    public FirestoreAIAnalysisDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public Optional<Map<String, Object>> findByAttemptId(String attemptId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("aiAnalyses")
                .document(attemptId)
                .get()
                .get();
        if (!snapshot.exists() || snapshot.getData() == null) {
            return Optional.empty();
        }
        return Optional.of(new LinkedHashMap<>(snapshot.getData()));
    }
}
