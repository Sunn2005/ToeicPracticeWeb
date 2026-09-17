package com.toeic.service;

import com.toeic.dto.ai.AIReviewRequest;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AIReviewRequestPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;

    public AIReviewRequestPublisher(
            RabbitTemplate rabbitTemplate,
            @Value("${app.ai.exchange}") String exchange,
            @Value("${app.ai.review-request-routing-key}") String routingKey
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    public void publish(AIReviewRequest request) {
        rabbitTemplate.convertAndSend(exchange, routingKey, request, message -> {
            message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            message.getMessageProperties().setContentType("application/json");
            message.getMessageProperties().setMessageId(request.attemptId());
            return message;
        });
    }
}
