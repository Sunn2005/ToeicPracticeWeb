package com.toeic.controller;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.CurrentUserService;
import com.toeic.dto.UpdateUserProfileRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class MeController {

    private final CurrentUserService currentUserService;

    public MeController(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    @GetMapping("/api/me")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getMe(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return currentUserService.getProfile(principal.uid());
    }

    @PatchMapping("/api/me")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> updateMe(
            @RequestBody UpdateUserProfileRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return currentUserService.updateProfile(
                principal.uid(),
                request.getDisplayName(),
                request.getPhotoUrl(),
                request.getTargetScore(),
                request.getPhoneNumber(),
                request.getDateOfBirth(),
                request.getGender()
        );
    }
}
