package com.toeic.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateSessionRequest(
        @NotBlank(message = "Firebase ID token là bắt buộc")
        String idToken
) {
}
