package com.toeic.controller;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.CurrentUserService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class MeController {

    private final CurrentUserService currentUserService;

    public MeController(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    @GetMapping("/api/me")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getMe(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) {
        return currentUserService.toResponse(principal.toUser());
    }
}
