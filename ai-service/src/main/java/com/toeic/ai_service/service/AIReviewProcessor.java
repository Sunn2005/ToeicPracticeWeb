package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIReviewRequest;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewStatistics;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AIReviewProcessor {

    private static final Logger log = LoggerFactory.getLogger(AIReviewProcessor.class);

    private final FirestoreReviewRepository repository;
    private final ReviewStatisticsService statisticsService;
    private final AIReviewGeminiService geminiService;
    private final AIReviewNotificationPublisher notificationPublisher;
    private final ObjectMapper objectMapper;
    private final String model;
    private final String promptVersion;
    private final String schemaVersion;

    public AIReviewProcessor(
            FirestoreReviewRepository repository,
            ReviewStatisticsService statisticsService,
            AIReviewGeminiService geminiService,
            AIReviewNotificationPublisher notificationPublisher,
            ObjectMapper objectMapper,
            @Value("${app.ai.review.model}") String model,
            @Value("${app.ai.review.prompt-version}") String promptVersion,
            @Value("${app.ai.review.schema-version}") String schemaVersion
    ) {
        this.repository = repository;
        this.statisticsService = statisticsService;
        this.geminiService = geminiService;
        this.notificationPublisher = notificationPublisher;
        this.objectMapper = objectMapper;
        this.model = model;
        this.promptVersion = promptVersion;
        this.schemaVersion = schemaVersion;
    }

    public void process(AIReviewRequest request) throws Exception {
        process(request, false);
    }

    public void process(AIReviewRequest request, boolean redelivered) throws Exception {
        validate(request);
        FirestoreReviewRepository.ClaimResult claim = repository.claim(
                request.attemptId(), request.userId(), redelivered
        );
        if (claim == FirestoreReviewRepository.ClaimResult.ALREADY_PROCESSING) {
            return;
        }
        if (claim == FirestoreReviewRepository.ClaimResult.ALREADY_COMPLETED) {
            notificationPublisher.completed(request.attemptId(), request.userId());
            return;
        }

        int retryCount = 0;
        try {
            ReviewInput input = repository.load(request.attemptId(), request.userId());
            ReviewStatistics statistics = statisticsService.calculate(input);
            AIReviewGeminiService.Generation generation = geminiService.analyze(input, statistics);
            retryCount = generation.retryCount();

            Map<String, Object> result = objectMapper.convertValue(
                    generation.analysis(),
                    new TypeReference<Map<String, Object>>() {
                    }
            );
            result = new LinkedHashMap<>(result);
            result.put("statistics", objectMapper.convertValue(
                    statistics,
                    new TypeReference<Map<String, Object>>() {
                    }
            ));

            repository.saveCompleted(
                    input, result, model, promptVersion, schemaVersion, retryCount
            );
        } catch (Exception exception) {
            String errorCode = errorCode(exception);
            if (exception instanceof AIReviewGeminiService.AIReviewGenerationException generation) {
                retryCount = generation.retryCount();
            }
            repository.saveFailed(request.attemptId(), request.userId(), errorCode, retryCount);
            notificationPublisher.failed(request.attemptId(), request.userId(), errorCode);
            log.error("AI review failed for attempt {} with code {}",
                    request.attemptId(), errorCode, exception);
            return;
        }

        // Thứ tự bắt buộc: validate -> save Firestore -> publish completed.
        notificationPublisher.completed(request.attemptId(), request.userId());
    }

    private void validate(AIReviewRequest request) {
        if (request == null || blank(request.attemptId()) || blank(request.userId())) {
            throw new IllegalArgumentException("AI review request không hợp lệ");
        }
    }

    private String errorCode(Throwable throwable) {
        if (throwable instanceof AIReviewGeminiService.AIReviewGenerationException generation) {
            return generation.errorCode();
        }
        if (throwable instanceof IllegalArgumentException) {
            return "INVALID_INPUT";
        }
        return "AI_REVIEW_FAILED";
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
