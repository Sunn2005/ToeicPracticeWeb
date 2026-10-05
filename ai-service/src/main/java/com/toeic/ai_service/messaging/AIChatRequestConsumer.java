package com.toeic.ai_service.messaging;

import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import com.toeic.ai_service.service.AIChatProcessor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AIChatRequestConsumer {
    private static final Logger log = LoggerFactory.getLogger(AIChatRequestConsumer.class);

    private final AIChatProcessor processor;
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String resultRoutingKey;

    public AIChatRequestConsumer(
            AIChatProcessor processor,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbitmq.exchange}") String exchange,
            @Value("${app.rabbitmq.chat-result-routing-key}") String resultRoutingKey
    ) {
        this.processor = processor;
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.resultRoutingKey = resultRoutingKey;
    }

    @RabbitListener(queues = "${app.rabbitmq.chat-request-queue}")
    public void consume(AIChatRequest request, Message message) throws Exception {
        log.info("Received AI chat request: jobId={}, conversationId={}",
                request == null ? null : request.jobId(),
                request == null ? null : request.conversationId());

        boolean recovery = Boolean.TRUE.equals(message.getMessageProperties().isRedelivered())
                || message.getMessageProperties().getRetryCount() > 0;
        AIChatResult result = processor.process(request, recovery).orElse(null);
        if (result == null) {
            log.info("AI chat request already processing: jobId={}",
                    request == null ? null : request.jobId());
            return;
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

}
