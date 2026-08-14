package com.toeic.controller;

import com.toeic.dto.CreateAttemptRequest;
import com.toeic.dto.SaveAnswerRequest;
import com.toeic.dto.UpdatePositionRequest;
import com.toeic.service.AttemptService;
import com.toeic.service.FirebaseAuthenticationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/attempts")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class AttemptController {

    private final FirebaseAuthenticationService authenticationService;
    private final AttemptService attemptService;

    public AttemptController(
            FirebaseAuthenticationService authenticationService,
            AttemptService attemptService
    ) {
        this.authenticationService = authenticationService;
        this.attemptService = attemptService;
    }

    // Tương thích với frontend cũ. Full Test mới ưu tiên
    // POST /api/tests/{testId}/attempts.
    @PostMapping
    public Map<String, Object> createAttempt(
            @RequestBody CreateAttemptRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        if (request.getTestId() == null || request.getTestId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu testId");
        }
        String userId = authenticationService.requireUid(authorization);
        return attemptService.createOrResume(
                userId,
                request.getTestId(),
                request.getMode(),
                request.getPart(),
                request.getParts(),
                request.getDurationMinutes()
        );
    }

    @GetMapping("/current")
    public Map<String, Object> getCurrentAttempt(
            @RequestParam String testId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.getCurrent(userId, testId);
    }

    @GetMapping("/{attemptId}")
    public Map<String, Object> getAttempt(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.getAttempt(userId, attemptId);
    }

    @GetMapping("/{attemptId}/exam")
    public Map<String, Object> getExam(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.getExam(userId, attemptId);
    }

    @PutMapping("/{attemptId}/answers")
    public Map<String, Object> saveAnswer(
            @PathVariable String attemptId,
            @RequestBody SaveAnswerRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.saveAnswer(
                userId,
                attemptId,
                request.getQuestionNumber(),
                request.getSelectedAnswer()
        );
    }

    @PutMapping("/{attemptId}/position")
    public Map<String, Object> updatePosition(
            @PathVariable String attemptId,
            @RequestBody UpdatePositionRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.updatePosition(userId, attemptId, request.getQuestionNumber());
    }

    @PostMapping("/{attemptId}/listening/next")
    public Map<String, Object> nextListening(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.nextListening(userId, attemptId);
    }

    @PostMapping("/{attemptId}/finish-listening")
    public Map<String, Object> finishListening(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.finishListening(userId, attemptId);
    }

    @PostMapping("/{attemptId}/submit")
    public Map<String, Object> submit(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.submit(userId, attemptId);
    }

    @GetMapping("/{attemptId}/result")
    public Map<String, Object> getResult(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.getResult(userId, attemptId);
    }

    @GetMapping("/{attemptId}/review")
    public Map<String, Object> getReview(
            @PathVariable String attemptId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        return attemptService.getReview(userId, attemptId);
    }
}
