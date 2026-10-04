package com.toeic.messaging;

import com.toeic.dto.ai.AIChatResult;
import com.toeic.service.AIChatResultService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class AIChatResultConsumer {
    private static final Logger log = LoggerFactory.getLogger(AIChatResultConsumer.class);
    private final AIChatResultService resultService;

    public AIChatResultConsumer(AIChatResultService resultService) {
        this.resultService = resultService;
    }

    @RabbitListener(queues = "${app.ai.chat-result-queue}")
    public void consume(AIChatResult result) throws Exception {
        boolean finalized = resultService.handle(result);
        log.info("AI chat result handled: jobId={}, status={}, finalized={}",
                result == null ? null : result.jobId(), result == null ? null : result.status(), finalized);
    }
}
