package com.toeic.dao.firestore;

import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import com.google.cloud.firestore.WriteBatch;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.toeic.dao.TestDao;
import com.toeic.model.Test;
import com.toeic.model.TestPart;
import com.toeic.model.enums.TestStatus;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

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

        Map<String, Object> data = snapshot.getData();
        if (data == null) {
            return Optional.empty();
        }
        return Optional.of(metadataFrom(testId, data));
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
            Map<String, Object> data = snapshot.getData();
            if (data != null) {
                tests.add(metadataFrom(snapshot.getId(), data));
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

    /**
     * Firestore returns native timestamp fields as {@link Timestamp}. Older and
     * newly-created test documents can therefore contain different runtime types
     * even though the API contract exposes epoch milliseconds. Map metadata
     * explicitly so both representations remain readable.
     */
    static Test metadataFrom(String testId, Map<String, Object> data) {
        Test test = new Test();
        test.setTestId(testId);
        test.setTitle(stringValue(data.get("title")));
        test.setDescription(stringValue(data.get("description")));
        test.setTotalQuestions(integerValue(data.get("totalQuestions"), "totalQuestions"));
        test.setType(stringValue(data.get("type")));
        test.setListeningMinutes(integerValue(data.get("listeningMinutes"), "listeningMinutes"));
        test.setReadingMinutes(integerValue(data.get("readingMinutes"), "readingMinutes"));
        test.setTotalMinutes(integerValue(data.get("totalMinutes"), "totalMinutes"));
        test.setStatus(statusValue(data.get("status")));
        test.setCreatedBy(stringValue(data.get("createdBy")));
        test.setCreatedAt(epochMillis(data.get("createdAt"), "createdAt"));
        test.setUpdatedAt(epochMillis(data.get("updatedAt"), "updatedAt"));
        test.setSubmittedAt(epochMillis(data.get("submittedAt"), "submittedAt"));
        test.setReviewedBy(stringValue(data.get("reviewedBy")));
        test.setReviewedAt(epochMillis(data.get("reviewedAt"), "reviewedAt"));
        test.setRejectionReason(stringValue(data.get("rejectionReason")));
        test.setParts(null);
        return test;
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

    private static TestStatus statusValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof TestStatus status) {
            return status;
        }
        if (value instanceof String status) {
            String normalized = status.trim().toUpperCase(Locale.ROOT);
            if ("PUBLISHED".equals(normalized)) {
                return TestStatus.APPROVED;
            }
            return TestStatus.valueOf(normalized);
        }
        throw unsupportedFieldType("status", value);
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

    private static IllegalArgumentException unsupportedFieldType(String fieldName, Object value) {
        return new IllegalArgumentException(
                "Kiểu dữ liệu Firestore không hợp lệ cho " + fieldName + ": "
                        + value.getClass().getName()
        );
    }
}
