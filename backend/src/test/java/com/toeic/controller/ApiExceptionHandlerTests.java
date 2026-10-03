package com.toeic.controller;

import com.toeic.dto.ApiErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ApiExceptionHandlerTests {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void apiCodeExceptionPreservesDomainCodeAndStatus() {
        HttpServletRequest request = request("/api/protected");

        ResponseEntity<ApiErrorResponse> response = handler.handleApiCode(
                new ApiCodeException(HttpStatus.FORBIDDEN, "PRO_REQUIRED", "Pro access required"),
                request
        );

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(403, response.getBody().status());
        assertEquals("PRO_REQUIRED", response.getBody().code());
        assertEquals("Pro access required", response.getBody().message());
        assertEquals("/api/protected", response.getBody().path());
    }

    @Test
    void responseStatusExceptionKeepsExistingStatusNameCode() {
        HttpServletRequest request = request("/api/legacy");

        ResponseEntity<ApiErrorResponse> response = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.CONFLICT, "Existing behavior"),
                request
        );

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        assertEquals(409, response.getBody().status());
        assertEquals("CONFLICT", response.getBody().code());
        assertEquals("Existing behavior", response.getBody().message());
        assertEquals("/api/legacy", response.getBody().path());
    }

    private MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(path);
        return request;
    }
}
