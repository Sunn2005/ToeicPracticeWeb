package com.toeic.controller;

import com.toeic.dto.RejectTestRequest;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.service.AdminReviewService;
import com.toeic.service.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class AdminReviewController {

    private final CurrentUserService currentUserService;
    private final AdminReviewService adminReviewService;

    public AdminReviewController(
            CurrentUserService currentUserService,
            AdminReviewService adminReviewService
    ) {
        this.currentUserService = currentUserService;
        this.adminReviewService = adminReviewService;
    }

    @GetMapping("/test-submissions")
    public List<Map<String, Object>> listSubmissions(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        requireAdmin(authorization);
        return adminReviewService.listPending();
    }

    @GetMapping("/test-submissions/{testId}")
    public Map<String, Object> getSubmission(
            @PathVariable String testId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        requireAdmin(authorization);
        return adminReviewService.getSubmission(testId);
    }

    @PostMapping("/test-submissions/{testId}/approve")
    public Map<String, Object> approve(
            @PathVariable String testId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User admin = requireAdmin(authorization);
        return adminReviewService.approve(admin.getUid(), testId);
    }

    @PostMapping("/test-submissions/{testId}/reject")
    public Map<String, Object> reject(
            @PathVariable String testId,
            @Valid @RequestBody RejectTestRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User admin = requireAdmin(authorization);
        return adminReviewService.reject(admin.getUid(), testId, request.reason());
    }

    @GetMapping("/review-history")
    public List<Map<String, Object>> reviewHistory(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        requireAdmin(authorization);
        return adminReviewService.reviewHistory();
    }

    private User requireAdmin(String authorization) throws Exception {
        return currentUserService.requireRole(authorization, UserRole.ADMIN);
    }
}
