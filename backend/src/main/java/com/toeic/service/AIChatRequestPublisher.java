package com.toeic.service;

import com.toeic.dto.ai.AIChatRequest;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AIChatRequestPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public AIChatRequestPublisher(
            RabbitTemplate rabbitTemplate,
            @Value("${app.ai.exchange}") String exchange,
            @Value("${app.ai.chat-request-routing-key}") String routingKey
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public void publish(AIChatRequest request) {
        rabbitTemplate.convertAndSend(exchange, routingKey, request, message -> {
            message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            message.getMessageProperties().setContentType("application/json");
            message.getMessageProperties().setMessageId(request.jobId());
            return message;
        });
    }
}
