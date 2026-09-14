package com.toeic.controller;

import com.toeic.dto.RejectTestRequest;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.AdminReviewService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})

public class AdminReviewController {

    private final AdminReviewService adminReviewService;

    public AdminReviewController(AdminReviewService adminReviewService) {
        this.adminReviewService = adminReviewService;
    }

    @GetMapping("/test-submissions")
    public List<Map<String, Object>> listSubmissions() throws Exception {
        return adminReviewService.listPending();
    }

    @GetMapping("/test-submissions/{testId}")
    public Map<String, Object> getSubmission(@PathVariable String testId) throws Exception {
        return adminReviewService.getSubmission(testId);
    }

    @PostMapping("/test-submissions/{testId}/approve")
    public Map<String, Object> approve(
            @PathVariable String testId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return adminReviewService.approve(principal.uid(), testId);
    }

    @PostMapping("/test-submissions/{testId}/reject")
    public Map<String, Object> reject(
            @PathVariable String testId,
            @Valid @RequestBody RejectTestRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return adminReviewService.reject(principal.uid(), testId, request.reason());
    }

    @GetMapping("/review-history")
    public List<Map<String, Object>> reviewHistory() throws Exception {
        return adminReviewService.reviewHistory();
    }
}
