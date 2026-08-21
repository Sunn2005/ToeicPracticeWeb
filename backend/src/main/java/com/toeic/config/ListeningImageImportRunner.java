package com.toeic.config;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.WriteBatch;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.import-listening-images", havingValue = "true")
public class ListeningImageImportRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ListeningImageImportRunner.class);
    private static final String PUBLIC_BASE_URL =
            "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/"
                    + "toeic-media/T01-media/picture/";
    private static final Map<Integer, Map<String, String>> GROUP_IMAGES = Map.of(
            3, Map.of(
                    "62-64", "T01-P3-62-64.png",
                    "65-67", "T01-P3-65-67.png",
                    "68-70", "T01-P3-68-70.png"
            ),
            4, Map.of(
                    "95-97", "T01-P4-95-97.png",
                    "98-100", "T01-P4-98-100.png"
            )
    );

    private final Firestore firestore;
    private final String testId;

    public ListeningImageImportRunner(
            Firestore firestore,
            @Value("${app.listening-image-test-id:test-1}") String testId
    ) {
        this.firestore = firestore;
        this.testId = testId;
    }

    @Override
    public void run(String... args) throws Exception {
        WriteBatch batch = firestore.batch();
        int updatedGroups = 0;

        for (Map.Entry<Integer, Map<String, String>> partEntry : GROUP_IMAGES.entrySet()) {
            int partNumber = partEntry.getKey();
            DocumentReference partDocument = firestore.collection("tests")
                    .document(testId)
                    .collection("parts")
                    .document("part" + partNumber);
            DocumentSnapshot snapshot = partDocument.get().get();
            if (!snapshot.exists()) {
                throw new IllegalStateException(
                        "Không tìm thấy Firestore document tests/" + testId + "/parts/part" + partNumber
                );
            }

            List<Map<String, Object>> groups = copyGroups(snapshot.get("groups"));
            Map<String, String> pendingImages = new LinkedHashMap<>(partEntry.getValue());
            for (Map<String, Object> group : groups) {
                String questionRange = String.valueOf(group.get("questionRange"));
                String filename = pendingImages.remove(questionRange);
                if (filename != null) {
                    group.put("imageUrl", PUBLIC_BASE_URL + filename);
                    updatedGroups++;
                }
            }
            if (!pendingImages.isEmpty()) {
                throw new IllegalStateException(
                        "Part " + partNumber + " thiếu group: " + pendingImages.keySet()
                );
            }
            batch.update(partDocument, "groups", groups);
        }

        batch.commit().get();
        log.info("Updated {} Listening group images for Firestore testId={}", updatedGroups, testId);
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
