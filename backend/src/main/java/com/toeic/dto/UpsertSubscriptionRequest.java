package com.toeic.dto;

import jakarta.validation.constraints.NotNull;

public record UpsertSubscriptionRequest(
        @NotNull(message = "Subscription expiry is required") Long expiresAt
) {
}
