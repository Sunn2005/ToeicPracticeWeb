package com.toeic.ai_service.service;

import com.google.cloud.firestore.FieldValue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

record ToeicKnowledgeChunk(
        String testId, long partNumber, long questionNumber, String question,
        List<Map<String, String>> options, String correctAnswer, String detailedExplanation,
        String grammarTopic, String questionType, String difficulty, String transcript
) {
    static final String COLLECTION = "aiKnowledgeChunks";
    private static final int MAX_TEXT_LENGTH = 1500;

    static ToeicKnowledgeChunk from(
            String testId, long partNumber, Map<?, ?> source, String parentTranscript
    ) {
        if (!(source.get("questionNumber") instanceof Number number)) {
            throw new IllegalArgumentException("Missing question number");
        }
        List<Map<String, String>> options = new ArrayList<>();
        if (source.get("answers") instanceof List<?> answers) {
            for (Object answer : answers) {
                if (answer instanceof Map<?, ?> option) {
                    String label = text(option.get("label"));
                    String content = text(option.get("content"));
                    if (!label.isEmpty() && !content.isEmpty()) {
                        options.add(Map.of("label", label, "content", content));
                    }
                }
            }
        }
        String transcript = text(source.get("transcript"));
        return new ToeicKnowledgeChunk(testId, partNumber, number.longValue(),
                text(source.get("question")), options, text(source.get("correctAnswer")),
                text(source.get("detailedExplanation")), text(source.get("grammarTopic")),
                text(source.get("questionType")), text(source.get("difficulty")),
                transcript.isEmpty() ? parentTranscript : transcript);
    }

    static String text(Object value) {
        return value instanceof String string ? string.strip() : "";
    }

    String id() {
        return testId + "-" + questionNumber;
    }

    String embeddingText() {
        StringBuilder result = new StringBuilder("Part " + partNumber + ". Question " + questionNumber + ": " + question);
        StringJoiner formattedOptions = new StringJoiner("; ");
        for (Map<String, String> option : options) {
            formattedOptions.add(option.get("label") + ": " + option.get("content"));
        }
        append(result, "Options", formattedOptions.toString());
        append(result, "Explanation", detailedExplanation);
        append(result, "Grammar", grammarTopic);
        append(result, "Type", questionType);
        if ((partNumber == 3 || partNumber == 4)
                && result.length() + " Transcript: ".length() < MAX_TEXT_LENGTH) {
            append(result, "Transcript", transcript);
        }
        if (result.length() > MAX_TEXT_LENGTH) {
            int end = MAX_TEXT_LENGTH;
            if (Character.isHighSurrogate(result.charAt(end - 1))) {
                end--;
            }
            result.setLength(end);
        }
        return result.toString();
    }

    private static void append(StringBuilder target, String label, String value) {
        if (!value.isBlank()) {
            target.append(' ').append(label).append(": ").append(value);
        }
    }

    Map<String, Object> document(String text, double[] vector) {
        return Map.ofEntries(
                Map.entry("testId", testId), Map.entry("partNumber", partNumber),
                Map.entry("questionNumber", questionNumber), Map.entry("text", text),
                Map.entry("embedding", FieldValue.vector(vector)), Map.entry("embeddingModel", RagEmbeddingService.MODEL),
                Map.entry("embeddingVersion", RagEmbeddingService.VERSION), Map.entry("sourceType", "QUESTION_EXPLANATION"),
                Map.entry("question", question), Map.entry("options", options),
                Map.entry("correctAnswer", correctAnswer), Map.entry("detailedExplanation", detailedExplanation),
                Map.entry("grammarTopic", grammarTopic), Map.entry("questionType", questionType),
                Map.entry("difficulty", difficulty), Map.entry("updatedAt", FieldValue.serverTimestamp()));
    }
}
