package com.toeic.dto;

import java.util.Map;

public record ApiErrorResponse(
        long timestamp,
        int status,
        String code,
        String message,
        String path,
        Map<String, String> fieldErrors
) {
    public static ApiErrorResponse of(
            int status,
            String code,
            String message,
            String path
    ) {
        return new ApiErrorResponse(
                System.currentTimeMillis(),
                status,
                code,
                message,
                path,
                Map.of()
        );
    }
}
