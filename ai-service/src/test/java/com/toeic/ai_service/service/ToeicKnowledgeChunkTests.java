package com.toeic.ai_service.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ToeicKnowledgeChunkTests {
    @Test
    void buildsTheEmbeddingTemplateAndSkipsBlankFieldsAndTranslations() {
        var question = Map.of(
                "questionNumber", 101, "question", "Choose a word.",
                "answers", List.of(Map.of("label", "A", "content", "quickly"),
                        Map.of("label", "B", "content", "quick")),
                "detailedExplanation", "Use an adverb.", "grammarTopic", "  ",
                "questionType", "GRAMMAR", "questionTranslation", "Bản dịch");

        var chunk = ToeicKnowledgeChunk.from("test-1", 5, question, "Other transcript");
        assertEquals("test-1-101", chunk.id());
        assertEquals("Part 5. Question 101: Choose a word. Options: A: quickly; B: quick"
                + " Explanation: Use an adverb. Type: GRAMMAR", chunk.embeddingText());
    }

    @Test
    void capsInheritedListeningTranscriptAtTheRemainingTextLength() {
        var question = Map.of("questionNumber", 32, "question", "What will the man do?",
                "detailedExplanation", "Listen for the next action.");
        String prefix = "Part 3. Question 32: What will the man do?"
                + " Explanation: Listen for the next action. Transcript: ";
        var chunk = ToeicKnowledgeChunk.from("test-1", 3, question, "a".repeat(2000));
        assertEquals(prefix + "a".repeat(1500 - prefix.length()), chunk.embeddingText());
        assertFalse(ToeicKnowledgeChunk.from("test-1", 7, question, "abc").embeddingText().contains("Transcript"));
    }
}
