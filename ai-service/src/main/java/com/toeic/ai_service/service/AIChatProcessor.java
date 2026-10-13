package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.model.ToeicChatAnswer;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AIChatProcessor {
    private final FirestoreChatResultRepository repository;
    private final AIChatPromptService promptService;

    public AIChatProcessor(
            FirestoreChatResultRepository repository,
            AIChatPromptService promptService
    ) {
        this.repository = repository;
        this.promptService = promptService;
    }

    public Optional<AIChatResult> process(AIChatRequest request, boolean redelivered) throws Exception {
        validate(request);
        FirestoreChatResultRepository.Claim claim = repository.claim(request, redelivered);
        if (claim.status() == FirestoreChatResultRepository.ClaimStatus.ALREADY_PROCESSING) {
            return Optional.empty();
        }
        if (claim.status() == FirestoreChatResultRepository.ClaimStatus.TERMINAL) {
            return Optional.of(claim.result());
        }

        AIChatResult generated;
        try {
            ToeicChatAnswer answer = promptService.answer(request);
            generated = AIChatResult.succeeded(request, answer.content());
        } catch (AIChatPromptService.InvalidChatRequestException invalidRequest) {
            throw invalidRequest;
        } catch (RuntimeException providerFailure) {
            generated = AIChatResult.failed(request, "AI_UNAVAILABLE");
        }
        return Optional.of(repository.saveTerminal(request, generated));
    }

    private void validate(AIChatRequest request) {
        if (request == null || blank(request.userId()) || blank(request.conversationId())
                || blank(request.jobId()) || blank(request.userMessageId())
                || blank(request.assistantMessageId()) || blank(request.currentMessage())
                || !("vi".equals(request.locale()) || "en".equals(request.locale()))) {
            throw new IllegalArgumentException("Invalid AI chat request");
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
