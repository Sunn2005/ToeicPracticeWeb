package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIReviewRequest;
import com.toeic.ai_service.model.GeminiAnalysis;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewStatistics;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AIReviewProcessorTests {

    @SuppressWarnings("unchecked")
    @Test
    void storesValidatedResultBeforePublishingCompletion() throws Exception {
        FirestoreReviewRepository repository = mock(FirestoreReviewRepository.class);
        ReviewStatisticsService statisticsService = mock(ReviewStatisticsService.class);
        AIReviewGeminiService geminiService = mock(AIReviewGeminiService.class);
        AIReviewNotificationPublisher publisher = mock(AIReviewNotificationPublisher.class);
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        AIReviewProcessor processor = new AIReviewProcessor(
                repository, statisticsService, geminiService, publisher, objectMapper,
                "gemini-test", "prompt-v1", "1.0"
        );
        ReviewInput input = new ReviewInput("attempt-1", "user-1", "test-1", Map.of(), List.of());
        ReviewStatistics statistics = new ReviewStatistics(
                0, 0, 0, 0, 0, 0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );
        GeminiAnalysis analysis = new GeminiAnalysis(
                new GeminiAnalysis.Summary("H", "C", 0, null, null),
                List.of(), List.of(), List.of(), List.of(),
                new GeminiAnalysis.TimeManagement(false, "INSUFFICIENT_DATA", "S", List.of()),
                List.of(), List.of(), List.of(), "LOW", List.of()
        );

        when(repository.claim("attempt-1", "user-1", false))
                .thenReturn(FirestoreReviewRepository.ClaimResult.CLAIMED);
        when(repository.load("attempt-1", "user-1")).thenReturn(input);
        when(statisticsService.calculate(input)).thenReturn(statistics);
        when(geminiService.analyze(input, statistics))
                .thenReturn(new AIReviewGeminiService.Generation(analysis, 0));
        when(objectMapper.convertValue(any(), any(TypeReference.class)))
                .thenReturn(new LinkedHashMap<>());

        processor.process(new AIReviewRequest("attempt-1", "user-1"));

        InOrder order = inOrder(repository, publisher);
        order.verify(repository).saveCompleted(
                any(), any(), any(), any(), any(), org.mockito.ArgumentMatchers.anyInt()
        );
        order.verify(publisher).completed("attempt-1", "user-1");
    }

    @Test
    void recordsGeminiRetryCountAndPublishesOnlyFailureIdentifiers() throws Exception {
        FirestoreReviewRepository repository = mock(FirestoreReviewRepository.class);
        ReviewStatisticsService statisticsService = mock(ReviewStatisticsService.class);
        AIReviewGeminiService geminiService = mock(AIReviewGeminiService.class);
        AIReviewNotificationPublisher publisher = mock(AIReviewNotificationPublisher.class);
        ObjectMapper objectMapper = mock(ObjectMapper.class);
        AIReviewProcessor processor = new AIReviewProcessor(
                repository, statisticsService, geminiService, publisher, objectMapper,
                "gemini-test", "prompt-v1", "1.0"
        );
        ReviewInput input = new ReviewInput("attempt-1", "user-1", "test-1", Map.of(), List.of());
        ReviewStatistics statistics = new ReviewStatistics(
                0, 0, 0, 0, 0, 0,
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                new ReviewStatistics.TimeManagement(false, Map.of())
        );

        when(repository.claim("attempt-1", "user-1", false))
                .thenReturn(FirestoreReviewRepository.ClaimResult.CLAIMED);
        when(repository.load("attempt-1", "user-1")).thenReturn(input);
        when(statisticsService.calculate(input)).thenReturn(statistics);
        when(geminiService.analyze(input, statistics)).thenThrow(
                new AIReviewGeminiService.AIReviewGenerationException(
                        "GEMINI_UNAVAILABLE", 2, new RuntimeException("503")
                )
        );

        processor.process(new AIReviewRequest("attempt-1", "user-1"));

        verify(repository).saveFailed("attempt-1", "user-1", "GEMINI_UNAVAILABLE", 2);
        verify(publisher).failed("attempt-1", "user-1", "GEMINI_UNAVAILABLE");
    }
}
