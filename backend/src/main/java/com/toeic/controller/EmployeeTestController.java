package com.toeic.controller;

import com.toeic.model.Test;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.EmployeeTestService;
import com.toeic.service.MediaStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/employee")
@PreAuthorize("hasAnyRole('EMPLOYEE', 'ADMIN')")
public class EmployeeTestController {

    private final EmployeeTestService employeeTestService;
    private final MediaStorageService mediaStorageService;

    public EmployeeTestController(
            EmployeeTestService employeeTestService,
            MediaStorageService mediaStorageService
    ) {
        this.employeeTestService = employeeTestService;
        this.mediaStorageService = mediaStorageService;
    }

    @GetMapping("/tests")
    public List<Map<String, Object>> list(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return employeeTestService.list(principal.uid());
    }

    @PostMapping("/tests")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(
            @RequestBody Test request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return employeeTestService.create(principal.uid(), request);
    }

    @GetMapping("/tests/{testId}")
    public Map<String, Object> get(
            @PathVariable String testId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return employeeTestService.get(principal.uid(), testId);
    }

    @PutMapping("/tests/{testId}")
    public Map<String, Object> update(
            @PathVariable String testId,
            @RequestBody Test request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return employeeTestService.update(principal.uid(), testId, request);
    }

    @DeleteMapping("/tests/{testId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable String testId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        employeeTestService.delete(principal.uid(), testId);
    }

    @PostMapping("/tests/{testId}/submit")
    public Map<String, Object> submit(
            @PathVariable String testId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return employeeTestService.submit(principal.uid(), testId);
    }

    @PostMapping(value = "/media", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return mediaStorageService.upload(principal.uid(), file);
    }
}
