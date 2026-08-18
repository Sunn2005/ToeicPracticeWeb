package com.toeic.service;

import com.toeic.dao.TestDao;
import com.toeic.model.Test;
import com.toeic.model.enums.TestStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class EmployeeTestService {

    private final TestDao testDao;
    private final TestManagementSupport support;

    public EmployeeTestService(TestDao testDao, TestManagementSupport support) {
        this.testDao = testDao;
        this.support = support;
    }

    public List<Map<String, Object>> list(String employeeUid) throws Exception {
        return testDao.findAllMetadata().stream()
                .filter(test -> employeeUid.equals(test.getCreatedBy()))
                .sorted(Comparator.comparing(
                        Test::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(test -> support.toMap(test, false))
                .toList();
    }

    public Map<String, Object> create(String employeeUid, Test request) throws Exception {
        support.validateDraftMetadata(request);
        long now = System.currentTimeMillis();
        request.setTestId(testDao.nextId());
        request.setCreatedBy(employeeUid);
        request.setStatus(TestStatus.DRAFT);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        clearReview(request);
        testDao.save(request);
        return support.toMap(request, true);
    }

    public Map<String, Object> get(String employeeUid, String testId) throws Exception {
        Test test = support.loadFullTest(testId);
        requireOwner(test, employeeUid);
        return support.toMap(test, true);
    }

    public Map<String, Object> update(String employeeUid, String testId, Test request) throws Exception {
        Test existing = support.requireMetadata(testId);
        requireOwner(existing, employeeUid);
        requireEditable(existing);
        support.validateDraftMetadata(request);

        request.setTestId(testId);
        request.setCreatedBy(existing.getCreatedBy());
        request.setCreatedAt(existing.getCreatedAt());
        request.setUpdatedAt(System.currentTimeMillis());
        request.setStatus(TestStatus.DRAFT);
        clearReview(request);
        testDao.save(request);
        return support.toMap(request, true);
    }

    public void delete(String employeeUid, String testId) throws Exception {
        Test existing = support.requireMetadata(testId);
        requireOwner(existing, employeeUid);
        requireEditable(existing);
        testDao.delete(testId);
    }

    public Map<String, Object> submit(String employeeUid, String testId) throws Exception {
        Test test = support.loadFullTest(testId);
        requireOwner(test, employeeUid);
        requireEditable(test);
        support.validateForSubmission(test);
        long now = System.currentTimeMillis();
        test.setStatus(TestStatus.PENDING_REVIEW);
        test.setSubmittedAt(now);
        test.setUpdatedAt(now);
        test.setReviewedAt(null);
        test.setReviewedBy(null);
        test.setRejectionReason(null);
        testDao.save(test);
        return support.toMap(test, true);
    }

    private void requireOwner(Test test, String employeeUid) {
        if (!employeeUid.equals(test.getCreatedBy())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không sở hữu đề thi này");
        }
    }

    private void requireEditable(Test test) {
        if (test.getStatus() != TestStatus.DRAFT && test.getStatus() != TestStatus.REJECTED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ được sửa hoặc xóa đề nháp và đề bị từ chối"
            );
        }
    }

    private void clearReview(Test test) {
        test.setSubmittedAt(null);
        test.setReviewedAt(null);
        test.setReviewedBy(null);
        test.setRejectionReason(null);
    }
}
