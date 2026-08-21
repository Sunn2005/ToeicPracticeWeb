package com.toeic.service;

import java.util.List;
import java.util.Map;

/**
 * Keeps review responses on the current schema while accepting tests saved
 * before the review fields were renamed.
 */
final class ReviewFieldNormalizer {

    private ReviewFieldNormalizer() {
    }

    static void normalize(Object value) {
        if (value instanceof Map<?, ?> map) {
            if (map.containsKey("questionNumber")) {
                normalizeLegacyTranslation(map);
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

    private static void normalizeLegacyTranslation(Map<?, ?> map) {
        Object legacyValue = map.get("translation");
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
