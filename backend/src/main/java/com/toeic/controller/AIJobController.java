package com.toeic.controller;

import com.toeic.dto.ai.AIJobRequest;
import com.toeic.service.AIJobService;
import com.toeic.service.FirebaseAuthenticationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/jobs")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class AIJobController {

    private final FirebaseAuthenticationService authenticationService;
    private final AIJobService aiJobService;

    public AIJobController(
            FirebaseAuthenticationService authenticationService,
            AIJobService aiJobService
    ) {
        this.authenticationService = authenticationService;
        this.aiJobService = aiJobService;
    }

    @PostMapping("/explanations")
    public ResponseEntity<Map<String, Object>> createExplanation(
            @RequestBody AIJobRequest.Payload payload,
            @RequestHeader(
                    value = HttpHeaders.AUTHORIZATION,
                    required = false
            ) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);

        return ResponseEntity.accepted().body(
                aiJobService.createExplanationJob(userId, payload)
        );
    }

    @GetMapping("/{jobId}")
    public Map<String, Object> getJob(
            @PathVariable String jobId,
            @RequestHeader(
                    value = HttpHeaders.AUTHORIZATION,
                    required = false
            ) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return aiJobService.getOwnedJob(userId, jobId);
    }
}