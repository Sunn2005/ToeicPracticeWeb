package com.toeic.controller;

import com.toeic.service.AttemptService;
import com.toeic.service.TestService;
import com.toeic.dto.CreateAttemptRequest;
import org.springframework.http.HttpStatus;
import com.toeic.security.ToeicUserPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/tests")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://capytoeic.id.vn",
        "https://www.capytoeic.id.vn"
})
public class TestController {

    private final TestService testService;
    private final AttemptService attemptService;

    public TestController(
            TestService testService,
            AttemptService attemptService
    ) {
        this.testService = testService;
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
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> createAttempt(
            @PathVariable String testId,
            @RequestBody(required = false) CreateAttemptRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        String mode = request == null ? null : request.getMode();
        Integer part = request == null ? null : request.getPart();
        return attemptService.createOrResume(
                principal.uid(),
                testId,
                mode,
                part,
                request == null ? null : request.getParts(),
                request == null ? null : request.getDurationMinutes(),
                request == null ? null : request.getType(),
                request == null ? null : request.getRestartExisting()
        );
    }

    // Endpoint tương thích để các trang luyện Part cũ vẫn lấy được dữ liệu,
    // nhưng response đã được lọc đáp án, bản dịch, lời giải và transcript.
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
