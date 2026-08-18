package com.toeic.controller;

import com.toeic.model.User;
import com.toeic.service.CurrentUserService;
import com.toeic.service.UserLearningService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users/me")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class UserController {

    private final CurrentUserService currentUserService;
    private final UserLearningService userLearningService;

    public UserController(
            CurrentUserService currentUserService,
            UserLearningService userLearningService
    ) {
        this.currentUserService = currentUserService;
        this.userLearningService = userLearningService;
    }

    @GetMapping("/attempts")
    public List<Map<String, Object>> getAttempts(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = currentUserService.requireUser(authorization);
        return userLearningService.getAttempts(user.getUid());
    }

    @GetMapping("/statistics")
    public Map<String, Object> getStatistics(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = currentUserService.requireUser(authorization);
        return userLearningService.getStatistics(user.getUid());
    }
}
