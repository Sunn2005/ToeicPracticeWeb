package com.toeic.controller;

import com.toeic.model.User;
import com.toeic.service.CurrentUserService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
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
    public Map<String, Object> getMe(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = currentUserService.requireUser(authorization);
        return currentUserService.toResponse(user);
    }
}
