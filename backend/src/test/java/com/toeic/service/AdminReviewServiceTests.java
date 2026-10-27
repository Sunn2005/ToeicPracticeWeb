package com.toeic.service;

import com.toeic.dao.TestDao;
import com.toeic.model.enums.TestStatus;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminReviewServiceTests {

    @Test
    void approvesOnlyAPendingSubmission() throws Exception {
        TestDao testDao = mock(TestDao.class);
        TestManagementSupport support = mock(TestManagementSupport.class);
        AdminReviewService service = new AdminReviewService(testDao, support);
        com.toeic.model.Test test = new com.toeic.model.Test();
        test.setTestId("test-1");
        test.setStatus(TestStatus.PENDING_REVIEW);
        when(support.loadFullTest("test-1")).thenReturn(test);
        when(support.toMap(test, true)).thenReturn(Map.of("status", "APPROVED"));

        Map<String, Object> result = service.approve("admin-1", "test-1");

        assertEquals("APPROVED", result.get("status"));
        assertEquals(TestStatus.APPROVED, test.getStatus());
        assertEquals("admin-1", test.getReviewedBy());
        verify(testDao).save(test);
    }

    @Test
    void requiresAReasonWhenRejecting() throws Exception {
        TestDao testDao = mock(TestDao.class);
        TestManagementSupport support = mock(TestManagementSupport.class);
        AdminReviewService service = new AdminReviewService(testDao, support);
        com.toeic.model.Test test = new com.toeic.model.Test();
        test.setStatus(TestStatus.PENDING_REVIEW);
        when(support.loadFullTest("test-1")).thenReturn(test);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.reject("admin-1", "test-1", "   ")
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }
    @Test
    void cannotApproveOrRejectOwnSubmission() throws Exception {
        TestDao dao = mock(TestDao.class);
        TestManagementSupport support = mock(TestManagementSupport.class);
        AdminReviewService service = new AdminReviewService(dao, support);
        com.toeic.model.Test submission = new com.toeic.model.Test();
        submission.setStatus(TestStatus.PENDING_REVIEW); submission.setCreatedBy("author");
        when(support.loadFullTest("own")).thenReturn(submission);
        for (var action : java.util.List.<org.junit.jupiter.api.function.Executable>of(
                () -> service.approve("author", "own"), () -> service.reject("author", "own", "Reason"))) {
            var error = assertThrows(com.toeic.controller.ApiCodeException.class, action);
            assertEquals("SELF_REVIEW_FORBIDDEN", error.getCode());
        }
        org.mockito.Mockito.verifyNoInteractions(dao);
        assertEquals(TestStatus.PENDING_REVIEW, submission.getStatus());
    }

}
