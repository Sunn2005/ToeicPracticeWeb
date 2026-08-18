package com.toeic.controller;

import com.toeic.service.AttemptService;
import com.toeic.service.FirebaseAuthenticationService;
import com.toeic.service.TestService;
import com.toeic.dto.CreateAttemptRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/tests")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class TestController {

    private final TestService testService;
    private final FirebaseAuthenticationService authenticationService;
    private final AttemptService attemptService;

    public TestController(
            TestService testService,
            FirebaseAuthenticationService authenticationService,
            AttemptService attemptService
    ) {
        this.testService = testService;
        this.authenticationService = authenticationService;
        this.attemptService = attemptService;
    }

    @GetMapping
    public List<Map<String, Object>> getPublishedTests() throws Exception {
        return testService.listPublishedTests();
    }

    @GetMapping("/{testId}")
    public Map<String, Object> getTestMetadata(@PathVariable String testId) throws Exception {
        return testService.getMetadata(testId);
    }

    @PostMapping("/{testId}/attempts")
    public Map<String, Object> createAttempt(
            @PathVariable String testId,
            @RequestBody(required = false) CreateAttemptRequest request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        String userId = authenticationService.requireUid(authorization);
        String mode = request == null ? null : request.getMode();
        Integer part = request == null ? null : request.getPart();
        return attemptService.createOrResume(
                userId,
                testId,
                mode,
                part,
                request == null ? null : request.getParts(),
                request == null ? null : request.getDurationMinutes()
        );
    }

    // Endpoint tương thích để các trang luyện Part cũ vẫn lấy được dữ liệu,
    // nhưng response đã được lọc correctAnswer/explanation/transcript.
    @GetMapping("/{testId}/parts/{partId}")
    public Map<String, Object> getPart(
            @PathVariable String testId,
            @PathVariable String partId
    ) throws Exception {
        int partNumber;
        try {
            partNumber = Integer.parseInt(partId.replaceFirst("(?i)^part", ""));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "partId phải có dạng part1 đến part7");
        }

        return testService.getExamPart(testId, partNumber);
    }
}
