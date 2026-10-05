package com.toeic.ai_service.messaging;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.service.AIChatProcessor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AIChatRequestConsumerTests {
    private AIChatProcessor processor;
    private RabbitTemplate rabbitTemplate;
    private AIChatRequestConsumer consumer;

    @BeforeEach
    void setUp() {
        processor = mock(AIChatProcessor.class);
        rabbitTemplate = mock(RabbitTemplate.class);
        consumer = new AIChatRequestConsumer(processor, rabbitTemplate, "toeic.ai", "ai.chat.result");
    }

    @Test
    void savedSuccessIsPublishedWithEveryIdentifierPreserved() throws Exception {
        AIChatRequest request = request();
        when(processor.process(request, false))
                .thenReturn(Optional.of(AIChatResult.succeeded(request, "Answer")));

        consumer.consume(request, delivery(false));

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
    void savedFailureIsPublishedWithoutChatContent() throws Exception {
        AIChatRequest request = request();
        when(processor.process(request, false))
                .thenReturn(Optional.of(AIChatResult.failed(request, "AI_UNAVAILABLE")));

        consumer.consume(request, delivery(false));

        AIChatResult result = capturedResult();
        assertEquals(AIChatResult.Status.FAILED, result.status());
        assertEquals("AI_UNAVAILABLE", result.errorCode());
        assertNull(result.answer());
    }

    @Test
    void activeDuplicateDoesNotPublishAnotherResult() throws Exception {
        AIChatRequest request = request();
        when(processor.process(request, false)).thenReturn(Optional.empty());

        consumer.consume(request, delivery(false));

        verify(rabbitTemplate, times(0)).convertAndSend(any(), any(), any(), any(MessagePostProcessor.class));
    }

    @Test
    void localListenerRetryIsTreatedAsRecoveryEvenBeforeBrokerRedelivery() throws Exception {
        AIChatRequest request = request();
        Message retry = delivery(false);
        retry.getMessageProperties().setRetryCount(1);
        when(processor.process(request, true)).thenReturn(Optional.empty());

        consumer.consume(request, retry);

        verify(processor).process(request, true);
    }

    @Test
    void invalidRequestFromProcessorIsRejectedWithoutPublishing() throws Exception {
        AIChatRequest invalid = request();
        when(processor.process(invalid, false)).thenThrow(new IllegalArgumentException("invalid"));

        assertThrows(IllegalArgumentException.class, () -> consumer.consume(invalid, delivery(false)));

        verify(rabbitTemplate, times(0)).convertAndSend(any(), any(), any(), any(MessagePostProcessor.class));
    }

    @Test
    void brokerFailureEscapesAndRedeliveryPublishesTheSameSavedResult() throws Exception {
        AIChatRequest request = request();
        AIChatResult saved = AIChatResult.succeeded(request, "Answer");
        when(processor.process(request, false)).thenReturn(Optional.of(saved));
        when(processor.process(request, true)).thenReturn(Optional.of(saved));
        doThrow(new IllegalStateException("broker unavailable")).when(rabbitTemplate)
                .convertAndSend(eq("toeic.ai"), eq("ai.chat.result"), any(AIChatResult.class),
                        any(MessagePostProcessor.class));

        assertThrows(IllegalStateException.class, () -> consumer.consume(request, delivery(false)));

        org.mockito.Mockito.reset(rabbitTemplate);
        consumer.consume(request, delivery(true));

        verify(processor).process(request, false);
        verify(processor).process(request, true);
        AIChatResult replayed = capturedResult();
        assertEquals(saved, replayed);
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

    private Message delivery(boolean redelivered) {
        Message message = new Message(new byte[0]);
        message.getMessageProperties().setRedelivered(redelivered);
        return message;
    }
}
