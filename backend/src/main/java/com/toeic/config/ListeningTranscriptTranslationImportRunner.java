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
 * Adds only the Part 3-4 transcript translations to an existing Firestore test.
 * All other group fields are copied from Firestore so this targeted import does
 * not replace questions, answers, media URLs, or explanations.
 */
@Component
@ConditionalOnProperty(name = "app.import-listening-transcript-translations", havingValue = "true")
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
            @Value("${app.listening-transcript-translation-test-id:test-1}") String testId
    ) {
        this.firestore = firestore;
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
        this.testId = testId;
    }

    @Override
    public void run(String... args) throws Exception {
        Map<Integer, Map<String, String>> translations = loadTranslations();
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
            Map<String, String> pendingTranslations =
                    new LinkedHashMap<>(translations.get(partNumber));
            for (Map<String, Object> group : groups) {
                String questionRange = String.valueOf(group.get("questionRange"));
                String translation = pendingTranslations.remove(questionRange);
                if (translation != null) {
                    group.put("transcriptTranslation", translation);
                    updatedGroups++;
                }
            }
            if (!pendingTranslations.isEmpty()) {
                throw new IllegalStateException(
                        "Part " + partNumber + " thiếu group trên Firestore: "
                                + pendingTranslations.keySet()
                );
            }
            batch.update(partDocument, "groups", groups);
        }

        batch.commit().get();
        log.info(
                "Updated {} Listening transcript translations for Firestore testId={}",
                updatedGroups,
                testId
        );
    }

    private Map<Integer, Map<String, String>> loadTranslations() throws Exception {
        if (!dataResource.exists()) {
            throw new IllegalStateException(
                    "Không tìm thấy file dữ liệu TOEIC: " + dataResource.getDescription()
            );
        }

        Test sourceTest;
        try (InputStream inputStream = dataResource.getInputStream()) {
            sourceTest = objectMapper.readValue(inputStream, Test.class);
        }

        Map<Integer, Map<String, String>> translations = new LinkedHashMap<>();
        for (TestPart part : sourceTest.getParts()) {
            if (!LISTENING_PARTS.contains(part.getPartNumber())) {
                continue;
            }
            Map<String, String> partTranslations = new LinkedHashMap<>();
            for (QuestionGroup group : part.getGroups()) {
                String translation = group.getTranscriptTranslation();
                if (translation == null || translation.isBlank()) {
                    throw new IllegalStateException(
                            "Thiếu transcriptTranslation cho group " + group.getQuestionRange()
                    );
                }
                partTranslations.put(group.getQuestionRange(), translation);
            }
            translations.put(part.getPartNumber(), partTranslations);
        }

        if (!translations.keySet().equals(LISTENING_PARTS)) {
            throw new IllegalStateException("Dữ liệu nguồn phải có đủ Part 3 và Part 4");
        }
        return translations;
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
}
