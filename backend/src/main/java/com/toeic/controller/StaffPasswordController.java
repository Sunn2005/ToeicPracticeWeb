package com.toeic.controller;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.StaffCredentialService;
import com.toeic.service.StaffRecoveryLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
public class StaffPasswordController {
    private final StaffCredentialService credentials;
    private final StaffRecoveryLimiter limiter;
    private final TaskExecutor executor;
    public StaffPasswordController(StaffCredentialService credentials, StaffRecoveryLimiter limiter,
            @Qualifier("staffRecoveryExecutor") TaskExecutor executor) {
        this.credentials = credentials; this.limiter = limiter; this.executor = executor;
    }
    // Password-bearing DTOs must not include generated toString() implementations.
    public static class PasswordRequest {
        public String email;
        public String token;
        public String oldPassword;
        public String newPassword;
    }
    @PostMapping("/api/v1/auth/staff/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> forgot(@RequestBody PasswordRequest body, HttpServletRequest request) {
        if (limiter.allow(request.getRemoteAddr())) {
            try { executor.execute(() -> credentials.requestReset(body.email)); }
            catch (org.springframework.core.task.TaskRejectedException ignored) { /* Same public response under load. */ }
        }
        return Map.of("code", "STAFF_RESET_REQUESTED");
    }
    @PostMapping("/api/v1/auth/staff/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@RequestBody PasswordRequest body, HttpServletRequest request) throws Exception {
        if (!limiter.allow(request.getRemoteAddr())) throw new ApiCodeException(HttpStatus.TOO_MANY_REQUESTS, "STAFF_RATE_LIMITED", "Vui lòng thử lại sau");
        credentials.reset(body.email, body.token, body.newPassword);
    }
    @PostMapping("/api/console/account/password")
    @PreAuthorize("isAuthenticated()")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void change(@AuthenticationPrincipal ToeicUserPrincipal actor, @RequestBody PasswordRequest body) throws Exception {
        credentials.change(actor.uid(), body.oldPassword, body.newPassword);
    }
}
