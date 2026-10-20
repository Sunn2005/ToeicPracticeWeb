package com.toeic.controller;

import com.toeic.dto.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiCodeException.class)
    public ResponseEntity<ApiErrorResponse> handleApiCode(
            ApiCodeException exception,
            HttpServletRequest request
    ) {
        int status = exception.getStatus().value();
        return ResponseEntity.status(exception.getStatus()).body(
                ApiErrorResponse.of(status, exception.getCode(), exception.getMessage(), request.getRequestURI())
        );
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request
    ) {
        int status = exception.getStatusCode().value();
        HttpStatus httpStatus = HttpStatus.resolve(status);
        String code = httpStatus == null ? "HTTP_" + status : httpStatus.name();
        String message = exception.getReason() == null
                ? "Yêu cầu không thể được xử lý"
                : exception.getReason();

        return ResponseEntity.status(status).body(
                ApiErrorResponse.of(status, code, message, request.getRequestURI())
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request
    ) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(
                    error.getField(),
                    error.getDefaultMessage() == null
                            ? "Giá trị không hợp lệ"
                            : error.getDefaultMessage()
            );
        }

        ApiErrorResponse response = new ApiErrorResponse(
                System.currentTimeMillis(),
                HttpStatus.BAD_REQUEST.value(),
                "VALIDATION_ERROR",
                "Dữ liệu gửi lên không hợp lệ",
                request.getRequestURI(),
                fieldErrors
        );
        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableBody(
            HttpMessageNotReadableException exception,
            HttpServletRequest request
    ) {
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of(
                        HttpStatus.BAD_REQUEST.value(),
                        "INVALID_REQUEST_BODY",
                        "Request body không hợp lệ",
                        request.getRequestURI()
                )
        );
    }
}
