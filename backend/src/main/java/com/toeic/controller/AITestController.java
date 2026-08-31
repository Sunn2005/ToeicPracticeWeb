package com.toeic.controller;

import com.toeic.dto.ai.AIJobRequest;
import com.toeic.service.AIRequestPublisher;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/internal/ai")
@ConditionalOnProperty(
        name = "app.ai.test-endpoint-enabled",
        havingValue = "true"
)
public class AITestController {

    private final AIRequestPublisher publisher;

    public AITestController(AIRequestPublisher publisher) {
        this.publisher = publisher;
    }

    @PostMapping("/explain")
    public ResponseEntity<Map<String, Object>> explain(
            @RequestBody AIJobRequest.Payload payload
    ) {
        String jobId = UUID.randomUUID().toString();

        AIJobRequest request = new AIJobRequest(
                1,
                jobId,
                "EXPLAIN_ANSWER",
                Instant.now().toString(),
                payload
        );

        publisher.publish(request);

        return ResponseEntity.accepted().body(Map.of(
                "jobId", jobId,
                "status", "PENDING"
        ));
    }
}