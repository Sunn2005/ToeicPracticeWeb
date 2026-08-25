package com.toeic.service;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ReviewFieldNormalizerTests {

    @Test
    void mapsLegacyReviewFieldsToTheCurrentSchema() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("questionNumber", 101);
        question.put("questionTranslation", null);
        question.put("detailedExplanation", null);
        question.put("translation", "Bản dịch cũ");
        question.put("explanation", "Lời giải cũ");

        ReviewFieldNormalizer.normalize(question);

        assertEquals("Bản dịch cũ", question.get("answerTranslation"));
        assertEquals("Lời giải cũ", question.get("detailedExplanation"));
        assertFalse(question.containsKey("translation"));
        assertFalse(question.containsKey("explanation"));
    }

    @Test
    void splitsLegacyPartSevenQuestionsAndAnswerChoices() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("questionNumber", 151);
        question.put("translation", "Câu hỏi tiếng Việt?\n(A) Lựa chọn A\n(B) Lựa chọn B");

        ReviewFieldNormalizer.normalize(question);

        assertEquals("Câu hỏi tiếng Việt?", question.get("questionTranslation"));
        assertEquals(
                "(A) Lựa chọn A\n(B) Lựa chọn B",
                question.get("answerTranslation")
        );
    }

    @Test
    void keepsCurrentValuesWhenLegacyFieldsAreAlsoPresent() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("questionNumber", 147);
        question.put("questionTranslation", "Bản dịch mới");
        question.put("detailedExplanation", "Lời giải mới");
        question.put("translation", "Bản dịch cũ");
        question.put("explanation", "Lời giải cũ");

        ReviewFieldNormalizer.normalize(question);

        assertEquals("Bản dịch mới", question.get("questionTranslation"));
        assertEquals("Lời giải mới", question.get("detailedExplanation"));
    }

    @Test
    void mapsStructuredTranslationsToTheExistingReviewApi() {
        Map<String, Object> question = new LinkedHashMap<>();
        question.put("questionNumber", 101);
        question.put("translation", Map.of(
                "question", "Câu hỏi tiếng Việt?",
                "answer", List.of(
                        Map.of("label", "A", "content", "Lựa chọn A"),
                        Map.of("label", "B", "content", "Lựa chọn B")
                )
        ));

        ReviewFieldNormalizer.normalize(question);

        assertEquals("Câu hỏi tiếng Việt?", question.get("questionTranslation"));
        assertEquals(
                "(A) Lựa chọn A\n(B) Lựa chọn B",
                question.get("answerTranslation")
        );
        assertFalse(question.containsKey("translation"));
    }
}
