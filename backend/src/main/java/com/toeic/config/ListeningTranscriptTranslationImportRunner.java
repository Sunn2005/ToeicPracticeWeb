package com.toeic.config;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.WriteBatch;
import com.toeic.model.QuestionGroup;
import com.toeic.model.Test;
import com.toeic.model.TestPart;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Adds only the readable Part 3-4 transcripts and their translations to an existing Firestore test.
 * All other group fields are copied from Firestore so this targeted import does
 * not replace questions, answers, media URLs, or explanations.
 */
@Component
@ConditionalOnProperty(name = "app.import-listening-review-text", havingValue = "true")
public class ListeningTranscriptTranslationImportRunner implements CommandLineRunner {

    private static final Logger log =
            LoggerFactory.getLogger(ListeningTranscriptTranslationImportRunner.class);
    private static final Set<Integer> LISTENING_PARTS = Set.of(3, 4);

    private final Firestore firestore;
    private final ObjectMapper objectMapper;
    private final Resource dataResource;
    private final String testId;

    public ListeningTranscriptTranslationImportRunner(
            Firestore firestore,
            ObjectMapper objectMapper,
            @Value("${app.toeic-data-resource}") Resource dataResource,
            @Value("${app.listening-review-text-test-id:test-1}") String testId
    ) {
        this.firestore = firestore;
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
        this.testId = testId;
    }

    @Override
    public void run(String... args) throws Exception {
        Map<Integer, Map<String, ListeningReviewText>> sourceGroups = loadReviewText();
        WriteBatch batch = firestore.batch();
        int updatedGroups = 0;

        for (int partNumber : LISTENING_PARTS) {
            DocumentReference partDocument = firestore.collection("tests")
                    .document(testId)
                    .collection("parts")
                    .document("part" + partNumber);
            DocumentSnapshot snapshot = partDocument.get().get();
            if (!snapshot.exists()) {
                throw new IllegalStateException(
                        "Không tìm thấy Firestore document tests/" + testId
                                + "/parts/part" + partNumber
                );
            }

            List<Map<String, Object>> groups = copyGroups(snapshot.get("groups"));
            Map<String, ListeningReviewText> pendingGroups =
                    new LinkedHashMap<>(sourceGroups.get(partNumber));
            for (Map<String, Object> group : groups) {
                String questionRange = String.valueOf(group.get("questionRange"));
                ListeningReviewText reviewText = pendingGroups.remove(questionRange);
                if (reviewText != null) {
                    group.put("transcript", reviewText.transcript());
                    group.put("transcriptTranslation", reviewText.translation());
                    updatedGroups++;
                }
            }
            if (!pendingGroups.isEmpty()) {
                throw new IllegalStateException(
                        "Part " + partNumber + " thiếu group trên Firestore: "
                                + pendingGroups.keySet()
                );
            }
            batch.update(partDocument, "groups", groups);
        }

        batch.commit().get();
        log.info(
                "Updated {} readable Listening transcripts and translations for Firestore testId={}",
                updatedGroups,
                testId
        );
    }

    private Map<Integer, Map<String, ListeningReviewText>> loadReviewText() throws Exception {
        if (!dataResource.exists()) {
            throw new IllegalStateException(
                    "Không tìm thấy file dữ liệu TOEIC: " + dataResource.getDescription()
            );
        }

        Test sourceTest;
        try (InputStream inputStream = dataResource.getInputStream()) {
            sourceTest = objectMapper.readValue(inputStream, Test.class);
        }

        Map<Integer, Map<String, ListeningReviewText>> reviewText = new LinkedHashMap<>();
        for (TestPart part : sourceTest.getParts()) {
            if (!LISTENING_PARTS.contains(part.getPartNumber())) {
                continue;
            }
            Map<String, ListeningReviewText> partReviewText = new LinkedHashMap<>();
            for (QuestionGroup group : part.getGroups()) {
                String transcript = group.getTranscript();
                String translation = group.getTranscriptTranslation();
                if (transcript == null || transcript.isBlank()
                        || translation == null || translation.isBlank()) {
                    throw new IllegalStateException(
                            "Thiếu transcript hoặc transcriptTranslation cho group "
                                    + group.getQuestionRange()
                    );
                }
                partReviewText.put(
                        group.getQuestionRange(),
                        new ListeningReviewText(transcript, translation)
                );
            }
            reviewText.put(part.getPartNumber(), partReviewText);
        }

        if (!reviewText.keySet().equals(LISTENING_PARTS)) {
            throw new IllegalStateException("Dữ liệu nguồn phải có đủ Part 3 và Part 4");
        }
        return reviewText;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> copyGroups(Object rawGroups) {
        if (!(rawGroups instanceof List<?> groupList)) {
            throw new IllegalStateException("Firestore part không có mảng groups hợp lệ");
        }

        List<Map<String, Object>> groups = new ArrayList<>();
        for (Object rawGroup : groupList) {
            if (!(rawGroup instanceof Map<?, ?> rawMap)) {
                throw new IllegalStateException("Firestore groups chứa phần tử không hợp lệ");
            }
            groups.add(new LinkedHashMap<>((Map<String, Object>) rawMap));
        }
        return groups;
    }

    private record ListeningReviewText(String transcript, String translation) {
    }
}
