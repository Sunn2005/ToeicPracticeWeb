package com.toeic.ai_service.messaging;

import com.toeic.ai_service.model.AIReviewRequest;
import com.toeic.ai_service.service.AIReviewProcessor;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class AIReviewRequestConsumer {

    private final AIReviewProcessor processor;

    public AIReviewRequestConsumer(AIReviewProcessor processor) {
        this.processor = processor;
    }

    @RabbitListener(queues = "${app.rabbitmq.review-request-queue}")
    public void consume(AIReviewRequest request, Message message) throws Exception {
        processor.process(request, message.getMessageProperties().isRedelivered());
    }
}
