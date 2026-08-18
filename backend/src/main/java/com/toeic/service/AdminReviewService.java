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
public class AdminReviewService {

    private final TestDao testDao;
    private final TestManagementSupport support;

    public AdminReviewService(TestDao testDao, TestManagementSupport support) {
        this.testDao = testDao;
        this.support = support;
    }

    public List<Map<String, Object>> listPending() throws Exception {
        return testDao.findAllMetadata().stream()
                .filter(test -> test.getStatus() == TestStatus.PENDING_REVIEW)
                .sorted(Comparator.comparing(
                        Test::getSubmittedAt,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .map(test -> support.toMap(test, false))
                .toList();
    }

    public Map<String, Object> getSubmission(String testId) throws Exception {
        Test test = support.loadFullTest(testId);
        requireSubmittedOrReviewed(test);
        return support.toMap(test, true);
    }

    public Map<String, Object> approve(String adminUid, String testId) throws Exception {
        Test test = support.loadFullTest(testId);
        requirePending(test);
        support.validateForSubmission(test);
        finishReview(test, adminUid, TestStatus.APPROVED, null);
        testDao.save(test);
        return support.toMap(test, true);
    }

    public Map<String, Object> reject(String adminUid, String testId, String reason) throws Exception {
        Test test = support.loadFullTest(testId);
        requirePending(test);
        String normalizedReason = reason == null ? "" : reason.trim();
        if (normalizedReason.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lý do từ chối không được để trống");
        }
        finishReview(test, adminUid, TestStatus.REJECTED, normalizedReason);
        testDao.save(test);
        return support.toMap(test, true);
    }

    public List<Map<String, Object>> reviewHistory() throws Exception {
        return testDao.findAllMetadata().stream()
                .filter(test -> test.getStatus() == TestStatus.APPROVED
                        || test.getStatus() == TestStatus.REJECTED)
                .filter(test -> test.getReviewedAt() != null)
                .sorted(Comparator.comparing(
                        Test::getReviewedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(test -> support.toMap(test, false))
                .toList();
    }

    private void finishReview(Test test, String adminUid, TestStatus status, String reason) {
        long now = System.currentTimeMillis();
        test.setStatus(status);
        test.setReviewedBy(adminUid);
        test.setReviewedAt(now);
        test.setUpdatedAt(now);
        test.setRejectionReason(reason);
    }

    private void requirePending(Test test) {
        if (test.getStatus() != TestStatus.PENDING_REVIEW) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Đề không còn ở trạng thái chờ duyệt"
            );
        }
    }

    private void requireSubmittedOrReviewed(Test test) {
        if (test.getStatus() == null || test.getStatus() == TestStatus.DRAFT) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy yêu cầu duyệt đề");
        }
    }
}
