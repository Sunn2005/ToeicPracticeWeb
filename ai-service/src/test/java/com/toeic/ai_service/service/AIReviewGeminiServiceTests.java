package com.toeic.ai_service.service;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class AIReviewGeminiServiceTests {

    @Test
    void classifies503AndConnectionFailuresAsRetryable() {
        AIReviewGeminiService service = new AIReviewGeminiService(
                mock(ChatClient.Builder.class),
                mock(ObjectMapper.class),
                new AIReviewValidator(),
                3,
                0
        );

        assertTrue(service.isTransient(new RuntimeException("503 Service Unavailable")));
        assertTrue(service.isTransient(new RuntimeException("connection timeout")));
        assertFalse(service.isTransient(new IllegalArgumentException("invalid input")));
    }
}
