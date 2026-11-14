package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.model.ToeicChatAnswer;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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

    @Test
    void savesASuccessWhenRetrievalThrows() throws Exception {
        var repository = mock(FirestoreChatResultRepository.class);
        var retrieval = mock(RagRetrievalService.class);
        var client = mock(ChatClient.class);
        var prompt = mock(ChatClient.ChatClientRequestSpec.class);
        var response = mock(ChatClient.CallResponseSpec.class);
        var request = request();
        var saved = AIChatResult.succeeded(request, "General guidance");

        when(retrieval.retrieve("Explain")).thenThrow(new IllegalStateException());
        when(client.prompt()).thenReturn(prompt);
        when(prompt.system(anyString())).thenReturn(prompt);
        when(prompt.user(new AIChatPromptService(client).prepare(request).user())).thenReturn(prompt);
        when(prompt.call()).thenReturn(response);
        when(response.entity(eq(ToeicChatAnswer.class), any())).thenReturn(new ToeicChatAnswer("General guidance"));
        when(repository.claim(request, false)).thenReturn(FirestoreChatResultRepository.Claim.claimed());
        when(repository.saveTerminal(request, saved)).thenReturn(saved);

        var service = new AIChatPromptService(client, 12, 12_000, retrieval, true);
        assertEquals(saved, new AIChatProcessor(repository, service).process(request, false).orElseThrow());
    }

    private AIChatRequest request() {
        return new AIChatRequest("user", "conversation", "job", "user-message",
                "assistant-message", "vi", List.of(), "Explain", null);
    }
}
