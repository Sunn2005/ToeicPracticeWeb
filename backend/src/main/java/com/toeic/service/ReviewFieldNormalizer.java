package com.toeic.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Keeps review responses on the established API schema while accepting both
 * legacy strings and the structured translation objects used by imported data.
 */
final class ReviewFieldNormalizer {

    private ReviewFieldNormalizer() {
    }

    static void normalize(Object value) {
        if (value instanceof Map<?, ?> map) {
            if (map.containsKey("questionNumber")) {
                normalizeTranslation(map);
                copyLegacyValue(map, "detailedExplanation", "explanation");
                map.remove("translation");
                map.remove("explanation");
            }
            for (Object child : map.values()) {
                normalize(child);
            }
        } else if (value instanceof List<?> list) {
            for (Object child : list) {
                normalize(child);
            }
        }
    }

    private static void normalizeTranslation(Map<?, ?> map) {
        Object legacyValue = map.get("translation");
        if (legacyValue instanceof Map<?, ?> structuredTranslation) {
            normalizeStructuredTranslation(map, structuredTranslation);
            return;
        }
        if (!(legacyValue instanceof String legacyTranslation)
                || legacyTranslation.isBlank()) {
            return;
        }

        Object numberValue = map.get("questionNumber");
        int questionNumber = numberValue instanceof Number number ? number.intValue() : 0;
        if (questionNumber >= 101 && questionNumber <= 146) {
            copyValueIfMissing(map, "answerTranslation", legacyTranslation);
            return;
        }

        if (questionNumber >= 147) {
            int choicesStart = legacyTranslation.indexOf("\n(A)");
            if (choicesStart >= 0) {
                copyValueIfMissing(
                        map,
                        "questionTranslation",
                        legacyTranslation.substring(0, choicesStart).trim()
                );
                copyValueIfMissing(
                        map,
                        "answerTranslation",
                        legacyTranslation.substring(choicesStart + 1).trim()
                );
                return;
            }

            String answerMarker = " Đáp án: ";
            int answerStart = legacyTranslation.indexOf(answerMarker);
            if (answerStart >= 0) {
                copyValueIfMissing(
                        map,
                        "questionTranslation",
                        legacyTranslation.substring(0, answerStart).trim()
                );
                copyValueIfMissing(
                        map,
                        "answerTranslation",
                        legacyTranslation.substring(answerStart + answerMarker.length()).trim()
                );
                return;
            }
        }

        copyValueIfMissing(map, "questionTranslation", legacyTranslation);
    }

    private static void normalizeStructuredTranslation(
            Map<?, ?> question,
            Map<?, ?> translation
    ) {
        Object translatedQuestion = translation.get("question");
        if (translatedQuestion instanceof String value && !value.isBlank()) {
            copyValueIfMissing(question, "questionTranslation", value.trim());
        }

        String translatedAnswers = formatTranslatedAnswers(translation.get("answer"));
        if (!translatedAnswers.isBlank()) {
            copyValueIfMissing(question, "answerTranslation", translatedAnswers);
        }
    }

    private static String formatTranslatedAnswers(Object value) {
        if (value instanceof String text) {
            return text.trim();
        }
        if (!(value instanceof List<?> answers)) {
            return "";
        }

        List<String> lines = new ArrayList<>();
        for (Object item : answers) {
            if (!(item instanceof Map<?, ?> answer)) {
                continue;
            }
            Object labelValue = answer.get("label");
            Object contentValue = answer.get("content");
            if (contentValue == null || String.valueOf(contentValue).isBlank()) {
                continue;
            }
            String label = labelValue == null ? "" : String.valueOf(labelValue).trim();
            String content = String.valueOf(contentValue).trim();
            lines.add(label.isBlank() ? content : "(" + label + ") " + content);
        }
        return String.join("\n", lines);
    }

    private static void copyLegacyValue(
            Map<?, ?> map,
            String currentField,
            String legacyField
    ) {
        if (map.get(currentField) == null && map.get(legacyField) != null) {
            copyValueIfMissing(map, currentField, map.get(legacyField));
        }
    }

    private static void copyValueIfMissing(Map<?, ?> map, String field, Object value) {
        if (map.get(field) == null) {
            put(map, field, value);
        }
    }

    @SuppressWarnings("unchecked")
    private static void put(Map<?, ?> map, String key, Object value) {
        ((Map<Object, Object>) map).put(key, value);
    }
}
