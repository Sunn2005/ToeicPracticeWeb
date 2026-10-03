package com.toeic.controller;

import com.toeic.dto.UpsertSubscriptionRequest;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.SubscriptionService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/subscriptions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSubscriptionController {
    private final SubscriptionService subscriptionService;

    public AdminSubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/{uid}")
    public SubscriptionService.SubscriptionSummary get(@PathVariable String uid) throws Exception {
        return subscriptionService.getSummary(uid);
    }

    @PutMapping("/{uid}")
    public SubscriptionService.SubscriptionSummary upsert(
            @PathVariable String uid,
            @Valid @RequestBody UpsertSubscriptionRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return subscriptionService.activateOrExtend(uid, request.expiresAt(), principal.uid());
    }

    @DeleteMapping("/{uid}")
    public SubscriptionService.SubscriptionSummary revoke(
            @PathVariable String uid,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return subscriptionService.revoke(uid, principal.uid());
    }
}
