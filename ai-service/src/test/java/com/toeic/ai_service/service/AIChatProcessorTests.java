package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.model.ToeicChatAnswer;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AIChatProcessorTests {

    @Test
    void savesGeneratedSuccessAndReplaysItOnRedeliveryWithoutCallingGeminiAgain() throws Exception {
        FirestoreChatResultRepository repository = mock(FirestoreChatResultRepository.class);
        AIChatPromptService promptService = mock(AIChatPromptService.class);
        AIChatProcessor processor = new AIChatProcessor(repository, promptService);
        AIChatRequest request = request();
        AIChatResult saved = AIChatResult.succeeded(request, "Saved answer");

        when(repository.claim(request, false))
                .thenReturn(FirestoreChatResultRepository.Claim.claimed());
        when(promptService.answer(request)).thenReturn(new ToeicChatAnswer("Saved answer"));
        when(repository.saveTerminal(request, saved)).thenReturn(saved);
        when(repository.claim(request, true))
                .thenReturn(FirestoreChatResultRepository.Claim.terminal(saved));

        assertEquals(saved, processor.process(request, false).orElseThrow());
        assertEquals(saved, processor.process(request, true).orElseThrow());

        verify(promptService).answer(request);
        verify(repository).saveTerminal(request, saved);
    }

    @Test
    void savesAStableFailureBeforeReturningItForPublication() throws Exception {
        FirestoreChatResultRepository repository = mock(FirestoreChatResultRepository.class);
        AIChatPromptService promptService = mock(AIChatPromptService.class);
        AIChatProcessor processor = new AIChatProcessor(repository, promptService);
        AIChatRequest request = request();
        AIChatResult failed = AIChatResult.failed(request, "AI_UNAVAILABLE");

        when(repository.claim(request, false))
                .thenReturn(FirestoreChatResultRepository.Claim.claimed());
        when(promptService.answer(request)).thenThrow(new IllegalStateException("provider detail"));
        when(repository.saveTerminal(request, failed)).thenReturn(failed);

        assertEquals(failed, processor.process(request, false).orElseThrow());
        verify(repository).saveTerminal(request, failed);
    }

    @Test
    void duplicateDeliveryWhileTheOriginalIsProcessingDoesNoGenerationOrPublicationWork() throws Exception {
        FirestoreChatResultRepository repository = mock(FirestoreChatResultRepository.class);
        AIChatPromptService promptService = mock(AIChatPromptService.class);
        AIChatProcessor processor = new AIChatProcessor(repository, promptService);
        AIChatRequest request = request();

        when(repository.claim(request, false))
                .thenReturn(FirestoreChatResultRepository.Claim.alreadyProcessing());

        Optional<AIChatResult> result = processor.process(request, false);

        assertTrue(result.isEmpty());
        verify(promptService, never()).answer(request);
        verify(repository, never()).saveTerminal(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private AIChatRequest request() {
        return new AIChatRequest("user", "conversation", "job", "user-message",
                "assistant-message", "vi", List.of(), "Explain", null);
    }
}
