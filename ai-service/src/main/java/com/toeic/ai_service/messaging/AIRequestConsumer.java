package com.toeic.ai_service.messaging;

import com.toeic.ai_service.model.AIJobRequest;
import com.toeic.ai_service.model.AIJobResult;
import com.toeic.ai_service.model.ToeicExplanation;
import com.toeic.ai_service.service.GeminiToeicService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AIRequestConsumer {

    private static final Logger log =
            LoggerFactory.getLogger(AIRequestConsumer.class);

    private final GeminiToeicService geminiToeicService;
    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String resultRoutingKey;

    public AIRequestConsumer(
            GeminiToeicService geminiToeicService,
            RabbitTemplate rabbitTemplate,
            @Value("${app.rabbitmq.exchange}") String exchange,
            @Value("${app.rabbitmq.result-routing-key}") String resultRoutingKey
    ) {
        this.geminiToeicService = geminiToeicService;
        this.rabbitTemplate = rabbitTemplate;
        this.exchange = exchange;
        this.resultRoutingKey = resultRoutingKey;
    }

    @RabbitListener(queues = "${app.rabbitmq.request-queue}")
    public void consume(AIJobRequest request) {
        log.info(
                "Received AI job: jobId={}, taskType={}",
                request.jobId(),
                request.taskType()
        );

        if (!"EXPLAIN_ANSWER".equals(request.taskType())) {
            throw new IllegalArgumentException(
                    "Unsupported task type: " + request.taskType()
            );
        }

        if (request.payload() == null) {
            throw new IllegalArgumentException("AI job payload is required");
        }

        ToeicExplanation explanation =
                geminiToeicService.explain(request.payload());

        AIJobResult result =
                AIJobResult.success(request.jobId(), explanation);

        rabbitTemplate.convertAndSend(
                exchange,
                resultRoutingKey,
                result
        );

        log.info(
                "Completed AI job and published result: jobId={}",
                request.jobId()
        );
    }
}