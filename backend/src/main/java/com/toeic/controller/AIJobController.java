package com.toeic.controller;

import com.toeic.dto.ai.AIJobRequest;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.AIJobService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai/jobs")
@PreAuthorize("isAuthenticated()")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://capytoeic.id.vn",
        "https://www.capytoeic.id.vn"
})
public class AIJobController {

    private final AIJobService aiJobService;

    public AIJobController(AIJobService aiJobService) {
        this.aiJobService = aiJobService;
    }

    @PostMapping("/explanations")
    public ResponseEntity<Map<String, Object>> createExplanation(
            @RequestBody AIJobRequest.Payload payload,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return ResponseEntity.accepted().body(
                aiJobService.createExplanationJob(principal.uid(), payload)
        );
    }

    @GetMapping("/{jobId}")
    public Map<String, Object> getJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return aiJobService.getOwnedJob(principal.uid(), jobId);
    }
}
