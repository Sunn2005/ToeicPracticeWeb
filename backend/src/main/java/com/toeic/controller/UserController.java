package com.toeic.controller;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.UserLearningService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users/me")
@PreAuthorize("isAuthenticated()")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://capytoeic.id.vn",
        "https://www.capytoeic.id.vn"
})
public class UserController {

    private final UserLearningService userLearningService;

    public UserController(UserLearningService userLearningService) {
        this.userLearningService = userLearningService;
    }

    @GetMapping("/attempts")
    public List<Map<String, Object>> getAttempts(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return userLearningService.getAttempts(principal.uid());
    }

    @GetMapping("/statistics")
    public Map<String, Object> getStatistics(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return userLearningService.getStatistics(principal.uid());
    }

    @DeleteMapping("/attempts/{attemptId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttempt(
            @PathVariable String attemptId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        userLearningService.deleteAttempt(principal.uid(), attemptId);
    }
}
