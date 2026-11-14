package com.toeic.dto.test;

import jakarta.validation.constraints.NotBlank;

public record RejectTestRequest(
        @NotBlank(message = "Lý do từ chối không được để trống") String reason
) {
}
