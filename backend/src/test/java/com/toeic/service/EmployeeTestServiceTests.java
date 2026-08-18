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

class EmployeeTestServiceTests {

    @Test
    void createsANewEmployeeTestAsDraft() throws Exception {
        TestDao testDao = mock(TestDao.class);
        TestManagementSupport support = mock(TestManagementSupport.class);
        EmployeeTestService service = new EmployeeTestService(testDao, support);
        com.toeic.model.Test request = new com.toeic.model.Test();
        request.setTitle("Test mới");
        when(testDao.nextId()).thenReturn("test-new");
        when(support.toMap(request, true)).thenReturn(Map.of("testId", "test-new"));

        Map<String, Object> result = service.create("employee-1", request);

        assertEquals("test-new", result.get("testId"));
        assertEquals("employee-1", request.getCreatedBy());
        assertEquals(TestStatus.DRAFT, request.getStatus());
        verify(testDao).save(request);
    }

    @Test
    void preventsEditingATestThatIsPendingReview() throws Exception {
        TestDao testDao = mock(TestDao.class);
        TestManagementSupport support = mock(TestManagementSupport.class);
        EmployeeTestService service = new EmployeeTestService(testDao, support);
        com.toeic.model.Test existing = new com.toeic.model.Test();
        existing.setTestId("test-1");
        existing.setCreatedBy("employee-1");
        existing.setStatus(TestStatus.PENDING_REVIEW);
        when(support.requireMetadata("test-1")).thenReturn(existing);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.update("employee-1", "test-1", new com.toeic.model.Test())
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void preventsReadingAnotherEmployeesTest() throws Exception {
        TestDao testDao = mock(TestDao.class);
        TestManagementSupport support = mock(TestManagementSupport.class);
        EmployeeTestService service = new EmployeeTestService(testDao, support);
        com.toeic.model.Test existing = new com.toeic.model.Test();
        existing.setTestId("test-1");
        existing.setCreatedBy("employee-2");
        when(support.loadFullTest("test-1")).thenReturn(existing);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> service.get("employee-1", "test-1")
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }
}
