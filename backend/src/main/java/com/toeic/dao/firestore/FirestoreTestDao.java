package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import com.google.cloud.firestore.WriteBatch;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.toeic.dao.TestDao;
import com.toeic.model.Test;
import com.toeic.model.TestPart;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.ArrayList;
import java.util.List;

@Repository
public class FirestoreTestDao implements TestDao {

    private final Firestore firestore;

    public FirestoreTestDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public Optional<Test> findMetadataById(String testId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("tests").document(testId).get().get();
        if (!snapshot.exists()) {
            return Optional.empty();
        }

        Test test = snapshot.toObject(Test.class);
        if (test == null) {
            return Optional.empty();
        }
        test.setTestId(testId);
        test.setParts(null);
        return Optional.of(test);
    }

    @Override
    public Optional<TestPart> findPart(String testId, int partNumber) throws Exception {
        DocumentSnapshot snapshot = firestore
                .collection("tests")
                .document(testId)
                .collection("parts")
                .document("part" + partNumber)
                .get()
                .get();
        if (!snapshot.exists()) {
            return Optional.empty();
        }
        return Optional.ofNullable(snapshot.toObject(TestPart.class));
    }

    @Override
    public List<Test> findAllMetadata() throws Exception {
        List<Test> tests = new ArrayList<>();
        for (QueryDocumentSnapshot snapshot : firestore.collection("tests").get().get().getDocuments()) {
            Test test = snapshot.toObject(Test.class);
            if (test != null) {
                test.setTestId(snapshot.getId());
                test.setParts(null);
                tests.add(test);
            }
        }
        return tests;
    }

    @Override
    public String nextId() {
        return firestore.collection("tests").document().getId();
    }

    @Override
    public void save(Test test) throws Exception {
        DocumentReference testDocument = firestore.collection("tests").document(test.getTestId());
        WriteBatch batch = firestore.batch();
        batch.set(testDocument, metadataDocument(test), SetOptions.merge());

        if (test.getParts() != null) {
            for (TestPart part : test.getParts()) {
                batch.set(
                        testDocument.collection("parts").document("part" + part.getPartNumber()),
                        part,
                        SetOptions.merge()
                );
            }
        }
        batch.commit().get();
    }

    @Override
    public void delete(String testId) throws Exception {
        DocumentReference testDocument = firestore.collection("tests").document(testId);
        WriteBatch batch = firestore.batch();
        for (QueryDocumentSnapshot part : testDocument.collection("parts").get().get().getDocuments()) {
            batch.delete(part.getReference());
        }
        batch.delete(testDocument);
        batch.commit().get();
    }

    private Map<String, Object> metadataDocument(Test test) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("testId", test.getTestId());
        metadata.put("title", test.getTitle());
        metadata.put("description", test.getDescription());
        metadata.put("totalQuestions", test.getTotalQuestions());
        putIfNotNull(metadata, "type", test.getType());
        putIfNotNull(metadata, "listeningMinutes", test.getListeningMinutes());
        putIfNotNull(metadata, "readingMinutes", test.getReadingMinutes());
        putIfNotNull(metadata, "totalMinutes", test.getTotalMinutes());
        metadata.put("status", test.getStatus());
        metadata.put("createdBy", test.getCreatedBy());
        metadata.put("createdAt", test.getCreatedAt());
        metadata.put("updatedAt", test.getUpdatedAt());
        metadata.put("submittedAt", test.getSubmittedAt());
        metadata.put("reviewedBy", test.getReviewedBy());
        metadata.put("reviewedAt", test.getReviewedAt());
        metadata.put("rejectionReason", test.getRejectionReason());
        return metadata;
    }

    private void putIfNotNull(Map<String, Object> target, String key, Object value) {
        if (value != null) {
            target.put(key, value);
        }
    }
}
