package com.toeic.messaging;

import com.toeic.dto.ai.AIReviewCompleted;
import com.toeic.dto.ai.AIReviewFailed;
import com.toeic.service.AIReviewService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class AIReviewResultConsumer {

    private final AIReviewService reviewService;

    public AIReviewResultConsumer(AIReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @RabbitListener(queues = "${app.ai.review-completed-queue}")
    public void completed(AIReviewCompleted message) throws Exception {
        reviewService.handleCompleted(message);
    }

    @RabbitListener(queues = "${app.ai.review-failed-queue}")
    public void failed(AIReviewFailed message) throws Exception {
        reviewService.handleFailed(message);
    }
}
