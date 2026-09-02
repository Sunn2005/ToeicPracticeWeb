package com.toeic.messaging;

import com.toeic.dto.ai.AIJobResult;
import com.toeic.service.AIJobService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class AIResultConsumer {

    private static final Logger log =
            LoggerFactory.getLogger(AIResultConsumer.class);

    private final AIJobService aiJobService;

    public AIResultConsumer(AIJobService aiJobService) {
        this.aiJobService = aiJobService;
    }

    @RabbitListener(queues = "${app.ai.result-queue}")
    public void consume(AIJobResult result) throws Exception {
        log.info(
                "Received AI result: jobId={}, status={}",
                result.jobId(),
                result.status()
        );

        aiJobService.handleResult(result);

        log.info("Saved AI result: jobId={}", result.jobId());
    }
}