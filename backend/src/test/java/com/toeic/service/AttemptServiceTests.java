package com.toeic.service;

import com.toeic.dao.AttemptDao;
import com.toeic.model.Attempt;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AttemptServiceTests {

    @Test
    void createsAttemptThroughDaoWithoutKnowingFirestore() throws Exception {
        AttemptDao attemptDao = mock(AttemptDao.class);
        TestService testService = mock(TestService.class);
        AttemptService attemptService = new AttemptService(attemptDao, testService);

        when(testService.getMetadata("ets-2026-test-1")).thenReturn(Map.of("testId", "ets-2026-test-1"));
        when(attemptDao.findByUserId("user-1")).thenReturn(List.of());
        when(attemptDao.nextId()).thenReturn("attempt-1");
        when(attemptDao.findAnswers("attempt-1")).thenReturn(Map.of());

        Map<String, Object> response = attemptService.createOrResume(
                "user-1",
                "ets-2026-test-1",
                "FULL",
                null
        );

        ArgumentCaptor<Attempt> captor = ArgumentCaptor.forClass(Attempt.class);
        verify(attemptDao).save(captor.capture());
        assertEquals("attempt-1", captor.getValue().getId());
        assertEquals("user-1", captor.getValue().getUserId());
        assertEquals("IN_PROGRESS", captor.getValue().getStatus());
        assertEquals("attempt-1", response.get("id"));
    }
}
