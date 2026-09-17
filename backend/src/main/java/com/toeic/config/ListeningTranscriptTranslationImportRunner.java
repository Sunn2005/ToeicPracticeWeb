package com.toeic.config;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.WriteBatch;
import com.toeic.model.QuestionGroup;
import com.toeic.model.Question;
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
 * Adds only the Listening review text required by the answer-review screen to
 * an existing Firestore test. Part 1-2 receive their question transcripts and
 * structured translations. Part 3-4 receive group transcripts, transcript
 * translations, and per-question detailed explanations. All unrelated fields
 * are copied from Firestore unchanged.
 */
@Component
@ConditionalOnProperty(name = "app.import-listening-review-text", havingValue = "true")
public class ListeningTranscriptTranslationImportRunner implements CommandLineRunner {

    private static final Logger log =
            LoggerFactory.getLogger(ListeningTranscriptTranslationImportRunner.class);
    private static final Set<Integer> LISTENING_PARTS = Set.of(1, 2, 3, 4);
    private static final Set<Integer> GROUPED_LISTENING_PARTS = Set.of(3, 4);

    private final Firestore firestore;
    private final ObjectMapper objectMapper;
    private final Resource dataResource;
    private final String testId;

    public ListeningTranscriptTranslationImportRunner(
            Firestore firestore,
            ObjectMapper objectMapper,
            @Value("${app.listening-review-text-resource}") Resource dataResource,
            @Value("${app.listening-review-text-test-id:test-1}") String testId
    ) {
        this.firestore = firestore;
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
        this.testId = testId;
    }

    @Override
    public void run(String... args) throws Exception {
        ListeningReviewData source = loadReviewData();
        WriteBatch batch = firestore.batch();
        int updatedGroups = 0;
        int updatedQuestions = 0;

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

            if (!GROUPED_LISTENING_PARTS.contains(partNumber)) {
                List<Map<String, Object>> questions = copyMaps(
                        snapshot.get("questions"),
                        "questions"
                );
                Map<Integer, QuestionReviewText> pendingQuestions =
                        new LinkedHashMap<>(source.questions().get(partNumber));
                for (Map<String, Object> question : questions) {
                    int questionNumber = questionNumber(question);
                    QuestionReviewText reviewText = pendingQuestions.remove(questionNumber);
                    if (reviewText == null) {
                        continue;
                    }
                    question.put("transcript", reviewText.transcript());
                    question.put("translation", reviewText.translation());
                    updatedQuestions++;
                }
                requireNoMissingQuestions(partNumber, pendingQuestions);
                batch.update(partDocument, "questions", questions);
                continue;
            }

            List<Map<String, Object>> groups = copyMaps(snapshot.get("groups"), "groups");
            Map<String, ListeningReviewText> pendingGroups =
                    new LinkedHashMap<>(source.groups().get(partNumber));
            for (Map<String, Object> group : groups) {
                String questionRange = String.valueOf(group.get("questionRange"));
                ListeningReviewText reviewText = pendingGroups.remove(questionRange);
                if (reviewText != null) {
                    group.put("transcript", reviewText.transcript());
                    group.put("transcriptTranslation", reviewText.translation());
                    List<Map<String, Object>> questions = copyMaps(
                            group.get("questions"),
                            "questions của group " + questionRange
                    );
                    Map<Integer, QuestionReviewText> pendingQuestions =
                            new LinkedHashMap<>(reviewText.questions());
                    for (Map<String, Object> question : questions) {
                        int questionNumber = questionNumber(question);
                        QuestionReviewText questionReviewText = pendingQuestions.remove(questionNumber);
                        if (questionReviewText == null) {
                            continue;
                        }
                        question.put(
                                "detailedExplanation",
                                questionReviewText.detailedExplanation()
                        );
                        updatedQuestions++;
                    }
                    requireNoMissingQuestions(partNumber, pendingQuestions);
                    group.put("questions", questions);
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
                "Updated {} Listening groups and {} question review fields for Firestore testId={}",
                updatedGroups,
                updatedQuestions,
                testId
        );
    }

    private ListeningReviewData loadReviewData() throws Exception {
        if (!dataResource.exists()) {
            throw new IllegalStateException(
                    "Không tìm thấy file dữ liệu TOEIC: " + dataResource.getDescription()
            );
        }

        Test sourceTest;
        try (InputStream inputStream = dataResource.getInputStream()) {
            sourceTest = objectMapper.readValue(inputStream, Test.class);
        }

        Map<Integer, Map<Integer, QuestionReviewText>> questionReviewText =
                new LinkedHashMap<>();
        Map<Integer, Map<String, ListeningReviewText>> groupReviewText =
                new LinkedHashMap<>();
        for (TestPart part : sourceTest.getParts()) {
            if (!LISTENING_PARTS.contains(part.getPartNumber())) {
                continue;
            }

            if (!GROUPED_LISTENING_PARTS.contains(part.getPartNumber())) {
                Map<Integer, QuestionReviewText> partQuestions = new LinkedHashMap<>();
                for (Question question : part.getQuestions()) {
                    if (question.getTranscript() == null || question.getTranscript().isBlank()
                            || question.getTranslation() == null) {
                        throw new IllegalStateException(
                                "Thiếu transcript hoặc translation cho câu "
                                        + question.getQuestionNumber()
                        );
                    }
                    partQuestions.put(
                            question.getQuestionNumber(),
                            new QuestionReviewText(
                                    question.getTranscript(),
                                    question.getTranslation(),
                                    question.getDetailedExplanation()
                            )
                    );
                }
                questionReviewText.put(part.getPartNumber(), partQuestions);
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
                Map<Integer, QuestionReviewText> groupQuestions = new LinkedHashMap<>();
                for (Question question : group.getQuestions()) {
                    if (question.getDetailedExplanation() == null
                            || question.getDetailedExplanation().isBlank()) {
                        throw new IllegalStateException(
                                "Thiếu detailedExplanation cho câu "
                                        + question.getQuestionNumber()
                        );
                    }
                    groupQuestions.put(
                            question.getQuestionNumber(),
                            new QuestionReviewText(
                                    question.getTranscript(),
                                    question.getTranslation(),
                                    question.getDetailedExplanation()
                            )
                    );
                }
                partReviewText.put(group.getQuestionRange(), new ListeningReviewText(
                        transcript,
                        translation,
                        groupQuestions
                ));
            }
            groupReviewText.put(part.getPartNumber(), partReviewText);
        }

        if (!questionReviewText.keySet().equals(Set.of(1, 2))
                || !groupReviewText.keySet().equals(GROUPED_LISTENING_PARTS)) {
            throw new IllegalStateException("Dữ liệu nguồn phải có đủ Part 1-4");
        }
        return new ListeningReviewData(questionReviewText, groupReviewText);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> copyMaps(Object rawValue, String fieldDescription) {
        if (!(rawValue instanceof List<?> values)) {
            throw new IllegalStateException(
                    "Firestore part không có mảng " + fieldDescription + " hợp lệ"
            );
        }

        List<Map<String, Object>> maps = new ArrayList<>();
        for (Object rawValueItem : values) {
            if (!(rawValueItem instanceof Map<?, ?> rawMap)) {
                throw new IllegalStateException(
                        "Firestore " + fieldDescription + " chứa phần tử không hợp lệ"
                );
            }
            maps.add(new LinkedHashMap<>((Map<String, Object>) rawMap));
        }
        return maps;
    }

    private int questionNumber(Map<String, Object> question) {
        Object value = question.get("questionNumber");
        if (value instanceof Number number) {
            return number.intValue();
        }
        throw new IllegalStateException("Firestore question thiếu questionNumber hợp lệ");
    }

    private void requireNoMissingQuestions(
            int partNumber,
            Map<Integer, QuestionReviewText> pendingQuestions
    ) {
        if (!pendingQuestions.isEmpty()) {
            throw new IllegalStateException(
                    "Part " + partNumber + " thiếu question trên Firestore: "
                            + pendingQuestions.keySet()
            );
        }
    }

    private record QuestionReviewText(
            String transcript,
            Object translation,
            String detailedExplanation
    ) {
    }

    private record ListeningReviewText(
            String transcript,
            String translation,
            Map<Integer, QuestionReviewText> questions
    ) {
    }

    private record ListeningReviewData(
            Map<Integer, Map<Integer, QuestionReviewText>> questions,
            Map<Integer, Map<String, ListeningReviewText>> groups
    ) {
    }
}
