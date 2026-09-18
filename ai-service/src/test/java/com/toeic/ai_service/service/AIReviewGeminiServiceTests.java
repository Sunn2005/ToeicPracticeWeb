package com.toeic.ai_service.service;

import com.toeic.ai_service.model.GeminiAnalysis;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewStatistics;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    @Test
    void classifiesStructuredOutputParsingFailuresAsInvalidGeminiOutput() {
        AIReviewGeminiService service = serviceWithMockBuilder();

        assertEquals(
                "INVALID_GEMINI_OUTPUT",
                service.errorCode(new FakeStructuredOutputException("bad JSON shape"))
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void requestsVietnameseAndEnglishAsSeparateStructuredOutputs() {
        ChatClient.Builder builder = mock(ChatClient.Builder.class);
        ChatClient client = mock(ChatClient.class);
        ChatClient.ChatClientRequestSpec request = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec response = mock(ChatClient.CallResponseSpec.class);
        AIReviewValidator validator = mock(AIReviewValidator.class);
        when(builder.build()).thenReturn(client);
        when(client.prompt()).thenReturn(request);
        when(request.system(anyString())).thenReturn(request);
        when(request.user(anyString())).thenReturn(request);
        when(request.call()).thenReturn(response);

        GeminiAnalysis analysis = new GeminiAnalysis(
                new GeminiAnalysis.Summary("Headline", "Comment", 0, null, null),
                List.of(), List.of(), List.of(), List.of(),
                new GeminiAnalysis.TimeManagement(
                        false, "INSUFFICIENT_DATA", "No timing data is available.", List.of()
                ),
                List.of(), List.of(), List.of(), "LOW", List.of()
        );
        when(response.entity(eq(GeminiAnalysis.class), any()))
                .thenReturn(analysis, analysis);

        AIReviewGeminiService service = new AIReviewGeminiService(
                builder, new ObjectMapper(), validator, 3, 0
        );
        ReviewInput input = new ReviewInput(
                "attempt-1", "user-1", "test-1", Map.of(), List.of()
        );
        ReviewStatistics statistics = new ReviewStatistics(
                0, 0, 0, 0, 0, 0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );

        service.analyze(input, statistics);

        verify(response, times(2)).entity(eq(GeminiAnalysis.class), any());
        verify(validator).validate(any(GeminiAnalysis.class), eq(input), eq(statistics), eq("vi"));
        verify(validator).validate(any(GeminiAnalysis.class), eq(input), eq(statistics), eq("en"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void retriesValidationFailuresUpToConfiguredAttemptLimit() {
        ChatClient.Builder builder = mock(ChatClient.Builder.class);
        ChatClient client = mock(ChatClient.class);
        ChatClient.ChatClientRequestSpec request = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec response = mock(ChatClient.CallResponseSpec.class);
        AIReviewValidator validator = mock(AIReviewValidator.class);
        when(builder.build()).thenReturn(client);
        when(client.prompt()).thenReturn(request);
        when(request.system(anyString())).thenReturn(request);
        when(request.user(anyString())).thenReturn(request);
        when(request.call()).thenReturn(response);

        GeminiAnalysis analysis = new GeminiAnalysis(
                new GeminiAnalysis.Summary("Headline", "Comment", 0, null, null),
                List.of(), List.of(), List.of(), List.of(),
                new GeminiAnalysis.TimeManagement(
                        false, "INSUFFICIENT_DATA", "No timing data is available.", List.of()
                ),
                List.of(), List.of(), List.of(), "LOW", List.of()
        );
        when(response.entity(eq(GeminiAnalysis.class), any())).thenReturn(analysis);

        ReviewInput input = new ReviewInput(
                "attempt-1", "user-1", "test-1", Map.of(), List.of()
        );
        ReviewStatistics statistics = new ReviewStatistics(
                0, 0, 0, 0, 0, 0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );
        doThrow(new AIReviewValidator.InvalidAIAnalysisException("priorityTopic.goal quá ngắn"))
                .doThrow(new AIReviewValidator.InvalidAIAnalysisException("nextAction.label quá ngắn"))
                .doNothing()
                .when(validator).validate(
                        any(GeminiAnalysis.class), eq(input), eq(statistics), eq("vi")
                );
        doNothing().when(validator).validate(
                any(GeminiAnalysis.class), eq(input), eq(statistics), eq("en")
        );

        AIReviewGeminiService service = new AIReviewGeminiService(
                builder, new ObjectMapper(), validator, 3, 0
        );
        AIReviewGeminiService.Generation generation = service.analyze(input, statistics);

        assertEquals(2, generation.retryCount());
        verify(response, times(4)).entity(eq(GeminiAnalysis.class), any());
        verify(validator, times(3)).validate(
                any(GeminiAnalysis.class), eq(input), eq(statistics), eq("vi")
        );
        verify(validator).validate(
                any(GeminiAnalysis.class), eq(input), eq(statistics), eq("en")
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void deliversStructurallyValidResultWhenOnlyContentQualityRetriesAreExhausted() {
        ChatClient.Builder builder = mock(ChatClient.Builder.class);
        ChatClient client = mock(ChatClient.class);
        ChatClient.ChatClientRequestSpec request = mock(ChatClient.ChatClientRequestSpec.class);
        ChatClient.CallResponseSpec response = mock(ChatClient.CallResponseSpec.class);
        AIReviewValidator validator = mock(AIReviewValidator.class);
        when(builder.build()).thenReturn(client);
        when(client.prompt()).thenReturn(request);
        when(request.system(anyString())).thenReturn(request);
        when(request.user(anyString())).thenReturn(request);
        when(request.call()).thenReturn(response);

        GeminiAnalysis analysis = new GeminiAnalysis(
                new GeminiAnalysis.Summary("Progress", "Comment", 0, null, null),
                List.of(), List.of(), List.of(), List.of(),
                new GeminiAnalysis.TimeManagement(
                        false, "INSUFFICIENT_DATA", "Unavailable", List.of()
                ),
                List.of(), List.of(), List.of(), "LOW", List.of()
        );
        when(response.entity(eq(GeminiAnalysis.class), any())).thenReturn(analysis);

        ReviewInput input = new ReviewInput(
                "attempt-1", "user-1", "test-1", Map.of(), List.of()
        );
        ReviewStatistics statistics = new ReviewStatistics(
                0, 0, 0, 0, 0, 0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );
        doThrow(new AIReviewValidator.InvalidAIContentException("label quá ngắn"))
                .when(validator).validate(
                        any(GeminiAnalysis.class), eq(input), eq(statistics), eq("vi")
                );
        doNothing().when(validator).validate(
                any(GeminiAnalysis.class), eq(input), eq(statistics), eq("en")
        );

        AIReviewGeminiService service = new AIReviewGeminiService(
                builder, new ObjectMapper(), validator, 3, 0
        );
        AIReviewGeminiService.Generation generation = service.analyze(input, statistics);

        assertEquals(2, generation.retryCount());
        verify(response, times(4)).entity(eq(GeminiAnalysis.class), any());
        verify(validator, times(3)).validate(
                any(GeminiAnalysis.class), eq(input), eq(statistics), eq("vi")
        );
        verify(validator).validate(
                any(GeminiAnalysis.class), eq(input), eq(statistics), eq("en")
        );
    }

    private AIReviewGeminiService serviceWithMockBuilder() {
        ChatClient.Builder builder = mock(ChatClient.Builder.class);
        when(builder.build()).thenReturn(mock(ChatClient.class));
        return new AIReviewGeminiService(
                builder,
                mock(ObjectMapper.class),
                new AIReviewValidator(),
                3,
                0
        );
    }

    private static class FakeStructuredOutputException extends RuntimeException {
        FakeStructuredOutputException(String message) {
            super(message);
        }
    }
}
