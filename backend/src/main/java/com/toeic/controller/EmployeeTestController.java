package com.toeic.controller;

import com.toeic.model.Test;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import com.toeic.service.CurrentUserService;
import com.toeic.service.EmployeeTestService;
import com.toeic.service.MediaStorageService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/employee")
@CrossOrigin(originPatterns = {
        "http://localhost:5173",
        "https://*.vercel.app"
})
public class EmployeeTestController {

    private final CurrentUserService currentUserService;
    private final EmployeeTestService employeeTestService;
    private final MediaStorageService mediaStorageService;

    public EmployeeTestController(
            CurrentUserService currentUserService,
            EmployeeTestService employeeTestService,
            MediaStorageService mediaStorageService
    ) {
        this.currentUserService = currentUserService;
        this.employeeTestService = employeeTestService;
        this.mediaStorageService = mediaStorageService;
    }

    @GetMapping("/tests")
    public List<Map<String, Object>> list(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        return employeeTestService.list(user.getUid());
    }

    @PostMapping("/tests")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(
            @RequestBody Test request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        return employeeTestService.create(user.getUid(), request);
    }

    @GetMapping("/tests/{testId}")
    public Map<String, Object> get(
            @PathVariable String testId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        return employeeTestService.get(user.getUid(), testId);
    }

    @PutMapping("/tests/{testId}")
    public Map<String, Object> update(
            @PathVariable String testId,
            @RequestBody Test request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        return employeeTestService.update(user.getUid(), testId, request);
    }

    @DeleteMapping("/tests/{testId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable String testId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        employeeTestService.delete(user.getUid(), testId);
    }

    @PostMapping("/tests/{testId}/submit")
    public Map<String, Object> submit(
            @PathVariable String testId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        return employeeTestService.submit(user.getUid(), testId);
    }

    @PostMapping(value = "/media", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) throws Exception {
        User user = requireEmployee(authorization);
        return mediaStorageService.upload(user.getUid(), file);
    }

    private User requireEmployee(String authorization) throws Exception {
        return currentUserService.requireRole(authorization, UserRole.EMPLOYEE, UserRole.ADMIN);
    }
}
