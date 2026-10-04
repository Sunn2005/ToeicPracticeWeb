package com.toeic.ai_service.messaging;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.model.ToeicChatAnswer;
import com.toeic.ai_service.service.AIChatPromptService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AIChatRequestConsumerTests {
    private AIChatPromptService promptService;
    private RabbitTemplate rabbitTemplate;
    private AIChatRequestConsumer consumer;

    @BeforeEach
    void setUp() {
        promptService = mock(AIChatPromptService.class);
        rabbitTemplate = mock(RabbitTemplate.class);
        consumer = new AIChatRequestConsumer(promptService, rabbitTemplate, "toeic.ai", "ai.chat.result");
    }

    @Test
    void successfulGenerationPublishesAnswerWithEveryIdentifierPreserved() {
        AIChatRequest request = request();
        when(promptService.answer(request)).thenReturn(new ToeicChatAnswer("Answer"));

        consumer.consume(request);

        AIChatResult result = capturedResult();
        assertEquals("user", result.userId());
        assertEquals("conversation", result.conversationId());
        assertEquals("job", result.jobId());
        assertEquals("assistant-message", result.assistantMessageId());
        assertEquals(AIChatResult.Status.SUCCEEDED, result.status());
        assertEquals("Answer", result.answer());
        assertNull(result.errorCode());
    }

    @Test
    void providerFailurePublishesStableUnavailableFailureWithoutChatContent() {
        AIChatRequest request = request();
        when(promptService.answer(request)).thenThrow(new IllegalStateException("provider leaked detail"));

        consumer.consume(request);

        AIChatResult result = capturedResult();
        assertEquals(AIChatResult.Status.FAILED, result.status());
        assertEquals("AI_UNAVAILABLE", result.errorCode());
        assertNull(result.answer());
    }

    @Test
    void providerIllegalArgumentFailureIsNotMistakenForAnInvalidEnvelope() {
        AIChatRequest request = request();
        when(promptService.answer(request)).thenThrow(new IllegalArgumentException("provider conversion failed"));

        consumer.consume(request);

        AIChatResult result = capturedResult();
        assertEquals(AIChatResult.Status.FAILED, result.status());
        assertEquals("AI_UNAVAILABLE", result.errorCode());
    }

    @Test
    void invalidRequestIsRejectedWithoutCallingProviderOrPublishing() {
        AIChatRequest invalid = new AIChatRequest("user", "conversation", "job", "user-message",
                "assistant-message", "fr", List.of(), "hello", null);

        assertThrows(IllegalArgumentException.class, () -> consumer.consume(invalid));

        verifyNoInteractions(promptService, rabbitTemplate);
    }

    @Test
    void brokerFailureEscapesSoRabbitListenerRetryCanHandleIt() {
        AIChatRequest request = request();
        when(promptService.answer(request)).thenReturn(new ToeicChatAnswer("Answer"));
        doThrow(new IllegalStateException("broker unavailable")).when(rabbitTemplate)
                .convertAndSend(eq("toeic.ai"), eq("ai.chat.result"), any(AIChatResult.class),
                        any(MessagePostProcessor.class));

        assertThrows(IllegalStateException.class, () -> consumer.consume(request));
    }

    private AIChatResult capturedResult() {
        ArgumentCaptor<AIChatResult> captor = ArgumentCaptor.forClass(AIChatResult.class);
        verify(rabbitTemplate).convertAndSend(eq("toeic.ai"), eq("ai.chat.result"), captor.capture(),
                any(MessagePostProcessor.class));
        return captor.getValue();
    }

    private AIChatRequest request() {
        return new AIChatRequest("user", "conversation", "job", "user-message", "assistant-message",
                "vi", List.of(), "Explain", null);
    }
}
