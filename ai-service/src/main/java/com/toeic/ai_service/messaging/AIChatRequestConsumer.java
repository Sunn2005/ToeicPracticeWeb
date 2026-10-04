package com.toeic.ai_service.messaging;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.model.ToeicChatAnswer;
import com.toeic.ai_service.service.AIChatPromptService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AIChatRequestConsumer {
    private static final Logger log = LoggerFactory.getLogger(AIChatRequestConsumer.class);

    private final AIChatPromptService promptService;
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String resultRoutingKey;

    public AIChatRequestConsumer(
            AIChatPromptService promptService,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbitmq.exchange}") String exchange,
            @Value("${app.rabbitmq.chat-result-routing-key}") String resultRoutingKey
    ) {
        this.promptService = promptService;
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.resultRoutingKey = resultRoutingKey;
    }

    @RabbitListener(queues = "${app.rabbitmq.chat-request-queue}")
    public void consume(AIChatRequest request) {
        validateEnvelope(request);
        log.info("Received AI chat request: jobId={}, conversationId={}",
                request.jobId(), request.conversationId());

        AIChatResult result;
        try {
            ToeicChatAnswer answer = promptService.answer(request);
            result = AIChatResult.succeeded(request, answer.content());
        } catch (AIChatPromptService.InvalidChatRequestException invalidRequest) {
            throw invalidRequest;
        } catch (RuntimeException providerFailure) {
            result = AIChatResult.failed(request, "AI_UNAVAILABLE");
        }

        publish(result);
        log.info("Published AI chat result: jobId={}, status={}", result.jobId(), result.status());
    }

    private void publish(AIChatResult result) {
        rabbitTemplate.convertAndSend(exchange, resultRoutingKey, result, message -> {
            message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            message.getMessageProperties().setContentType("application/json");
            message.getMessageProperties().setMessageId(result.jobId());
            return message;
        });
    }

    private void validateEnvelope(AIChatRequest request) {
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
