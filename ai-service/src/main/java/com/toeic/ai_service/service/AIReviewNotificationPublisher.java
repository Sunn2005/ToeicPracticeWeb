package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIReviewCompleted;
import com.toeic.ai_service.model.AIReviewFailed;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AIReviewNotificationPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String completedRoutingKey;
    private final String failedRoutingKey;

    public AIReviewNotificationPublisher(
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbitmq.exchange}") String exchange,
            @Value("${app.rabbitmq.review-completed-routing-key}") String completedRoutingKey,
            @Value("${app.rabbitmq.review-failed-routing-key}") String failedRoutingKey
    ) {
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.completedRoutingKey = completedRoutingKey;
        this.failedRoutingKey = failedRoutingKey;
    }

    public void completed(String attemptId, String userId) {
        publish(completedRoutingKey, attemptId, new AIReviewCompleted(
                attemptId, userId, attemptId, "COMPLETED"
        ));
    }

    public void failed(String attemptId, String userId, String errorCode) {
        publish(failedRoutingKey, attemptId, new AIReviewFailed(
                attemptId, userId, "FAILED", errorCode
        ));
    }

    private void publish(String routingKey, String messageId, Object payload) {
        rabbitTemplate.convertAndSend(exchange, routingKey, payload, message -> {
            message.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            message.getMessageProperties().setContentType("application/json");
            message.getMessageProperties().setMessageId(messageId);
            return message;
        });
    }
}
