package com.toeic.controller;

import com.toeic.dto.CreateAttemptRequest;
import com.toeic.dto.SaveAnswerRequest;
import com.toeic.dto.UpdatePositionRequest;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.AttemptService;
import com.toeic.service.AIReviewService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/attempts")
@PreAuthorize("isAuthenticated()")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class AttemptController {

    private final AttemptService attemptService;
    private final AIReviewService aiReviewService;

    public AttemptController(AttemptService attemptService, AIReviewService aiReviewService) {
        this.attemptService = attemptService;
        this.aiReviewService = aiReviewService;
    }

    // Tương thích với frontend cũ. Full Test mới ưu tiên
    // POST /api/tests/{testId}/attempts.
    @PostMapping
    public Map<String, Object> createAttempt(
            @RequestBody CreateAttemptRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        if (request.getTestId() == null || request.getTestId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu testId");
        }
        return attemptService.createOrResume(
                principal.uid(),
                request.getTestId(),
                request.getMode(),
                request.getPart(),
                request.getParts(),
                request.getDurationMinutes(),
                request.getType()
        );
    }

    @GetMapping("/current")
    public Map<String, Object> getCurrentAttempt(
            @RequestParam String testId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.getCurrent(principal.uid(), testId);
    }

    @GetMapping("/{attemptId}")
    public Map<String, Object> getAttempt(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.getAttempt(principal.uid(), attemptId);
    }

    @GetMapping("/{attemptId}/exam")
    public Map<String, Object> getExam(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.getExam(principal.uid(), attemptId);
    }

    @PutMapping("/{attemptId}/answers")
    public Map<String, Object> saveAnswer(
            @PathVariable String attemptId,
            @RequestBody SaveAnswerRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.saveAnswer(
                principal.uid(),
                attemptId,
                request.getQuestionNumber(),
                request.getSelectedAnswer()
        );
    }

    @PutMapping("/{attemptId}/position")
    public Map<String, Object> updatePosition(
            @PathVariable String attemptId,
            @RequestBody UpdatePositionRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.updatePosition(principal.uid(), attemptId, request.getQuestionNumber());
    }

    @PostMapping("/{attemptId}/listening/next")
    public Map<String, Object> nextListening(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.nextListening(principal.uid(), attemptId);
    }

    @PostMapping("/{attemptId}/finish-listening")
    public Map<String, Object> finishListening(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.finishListening(principal.uid(), attemptId);
    }

    @PostMapping("/{attemptId}/submit")
    public Map<String, Object> submit(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.submit(principal.uid(), attemptId);
    }

    @PostMapping("/{attemptId}/submit-for-review")
    public Map<String, Object> submitForReview(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.submitForReview(principal.uid(), attemptId);
    }

    @GetMapping("/{attemptId}/result")
    public Map<String, Object> getResult(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.getResult(principal.uid(), attemptId);
    }

    @GetMapping("/{attemptId}/review")
    public Map<String, Object> getReview(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return attemptService.getReview(principal.uid(), attemptId);
    }

    @PostMapping("/{attemptId}/ai-analysis")
    public Map<String, Object> requestAIAnalysis(
            @PathVariable String attemptId,
            @RequestParam(defaultValue = "false") boolean refresh,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return aiReviewService.requestAnalysis(principal.uid(), attemptId, refresh);
    }

    @GetMapping("/{attemptId}/ai-analysis")
    public Map<String, Object> getAIAnalysis(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return aiReviewService.getAnalysis(principal.uid(), attemptId);
    }
}
