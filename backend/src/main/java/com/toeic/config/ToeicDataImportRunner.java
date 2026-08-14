package com.toeic.config;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
import com.google.cloud.firestore.WriteBatch;
import com.google.cloud.firestore.WriteResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@ConditionalOnProperty(
        name = "app.import-toeic-data",
        havingValue = "true"
)
public class ToeicDataImportRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ToeicDataImportRunner.class);
    private static final Set<Integer> EXPECTED_PART_NUMBERS = Set.of(1, 2, 3, 4, 5, 6, 7);

    private final Firestore firestore;
    private final ObjectMapper objectMapper;
    private final Resource dataResource;

    public ToeicDataImportRunner(
            Firestore firestore,
            ObjectMapper objectMapper,
            @Value("${app.toeic-data-resource}") Resource dataResource
    ) {
        this.firestore = firestore;
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
    }

    @Override
    public void run(String... args) throws Exception {
        if (!dataResource.exists()) {
            throw new IllegalStateException(
                    "Không tìm thấy file dữ liệu TOEIC: " + dataResource.getDescription()
            );
        }

        Map<String, Object> testData;
        try (InputStream inputStream = dataResource.getInputStream()) {
            testData = objectMapper.readValue(
                    inputStream,
                    new TypeReference<Map<String, Object>>() {
                    }
            );
        }

        String testId = requireText(testData, "testId");
        List<Map<String, Object>> parts = requireParts(testData.get("parts"));
        validateParts(parts);

        Map<String, Object> testDocumentData = new LinkedHashMap<>(testData);
        testDocumentData.remove("parts");

        DocumentReference testDocument = firestore
                .collection("tests")
                .document(testId);

        WriteBatch batch = firestore.batch();
        batch.set(testDocument, testDocumentData, SetOptions.merge());

        for (Map<String, Object> part : parts) {
            int partNumber = requirePartNumber(part);
            batch.set(
                    testDocument.collection("parts").document("part" + partNumber),
                    part,
                    SetOptions.merge()
            );
        }

        log.info(
                "Importing TOEIC testId={} with {} parts from {}",
                testId,
                parts.size(),
                dataResource.getDescription()
        );

        ApiFuture<List<WriteResult>> commit = batch.commit();
        List<WriteResult> writeResults = commit.get();

        log.info(
                "Imported TOEIC testId={} successfully: {} Firestore documents written",
                testId,
                writeResults.size()
        );
    }

    private String requireText(Map<String, Object> data, String fieldName) {
        Object value = data.get(fieldName);
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(
                    "Dữ liệu import thiếu field bắt buộc: " + fieldName
            );
        }
        return text;
    }

    private List<Map<String, Object>> requireParts(Object value) {
        if (!(value instanceof List<?> rawParts)) {
            throw new IllegalArgumentException("Dữ liệu import thiếu mảng parts");
        }

        List<Map<String, Object>> parts = new ArrayList<>();
        for (Object rawPart : rawParts) {
            if (!(rawPart instanceof Map<?, ?> rawMap)) {
                throw new IllegalArgumentException("Mỗi phần tử trong parts phải là object");
            }

            Map<String, Object> part = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
                if (!(entry.getKey() instanceof String key)) {
                    throw new IllegalArgumentException("Field trong part phải có key dạng chuỗi");
                }
                part.put(key, entry.getValue());
            }
            parts.add(part);
        }
        return parts;
    }

    private void validateParts(List<Map<String, Object>> parts) {
        Set<Integer> partNumbers = new HashSet<>();
        for (Map<String, Object> part : parts) {
            int partNumber = requirePartNumber(part);
            if (!partNumbers.add(partNumber)) {
                throw new IllegalArgumentException("Trùng partNumber: " + partNumber);
            }
        }

        if (!partNumbers.equals(EXPECTED_PART_NUMBERS)) {
            throw new IllegalArgumentException(
                    "Dữ liệu phải có đủ partNumber 1-7, hiện tại: " + partNumbers
            );
        }
    }

    private int requirePartNumber(Map<String, Object> part) {
        Object value = part.get("partNumber");
        if (!(value instanceof Number number)) {
            throw new IllegalArgumentException("Part thiếu partNumber hợp lệ");
        }
        return number.intValue();
    }
}
