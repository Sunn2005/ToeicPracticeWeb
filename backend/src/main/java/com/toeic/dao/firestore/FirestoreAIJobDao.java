package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.dao.AIJobDao;
import com.toeic.model.AIJob;
import com.toeic.model.AIExplanationResult;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Repository
public class FirestoreAIJobDao implements AIJobDao {

    private final Firestore firestore;

    public FirestoreAIJobDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public void save(AIJob job) throws Exception {
        firestore.collection("aiJobs")
                .document(job.getId())
                .set(job)
                .get();
    }

    @Override
    public Optional<AIJob> findById(String jobId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("aiJobs")
                .document(jobId)
                .get()
                .get();

        if (!snapshot.exists()) {
            return Optional.empty();
        }

        AIJob job = snapshot.toObject(AIJob.class);
        if (job != null && job.getId() == null) {
            job.setId(snapshot.getId());
        }

        return Optional.ofNullable(job);
    }

    @Override
    public boolean markSucceeded(
            String jobId,
            AIExplanationResult result,
            long completedAt
    ) throws Exception {
        DocumentReference reference = firestore.collection("aiJobs")
                .document(jobId);

        if (!reference.get().get().exists()) {
            return false;
        }

        Map<String, Object> updates = new LinkedHashMap<>();
        updates.put("status", "SUCCEEDED");
        updates.put("result", result);
        updates.put("completedAt", completedAt);
        updates.put("updatedAt", completedAt);
        updates.put("error", "");
        reference.update(updates).get();

        return true;
    }

    @Override
    public boolean markFailed(
            String jobId,
            String error,
            long completedAt
    ) throws Exception {
        DocumentReference reference = firestore.collection("aiJobs")
                .document(jobId);

        if (!reference.get().get().exists()) {
            return false;
        }

        Map<String, Object> updates = new LinkedHashMap<>();
        updates.put("status", "FAILED");
        updates.put("error", error == null ? "AI processing failed" : error);
        updates.put("completedAt", completedAt);
        updates.put("updatedAt", completedAt);

        reference.update(updates).get();
        return true;
    }
}
