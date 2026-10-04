package com.toeic.service;

import com.toeic.dao.AIChatDao;
import com.toeic.dto.ai.AIChatResult;
import com.toeic.model.AIChatJob;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AIChatResultServiceTests {
    private static final long NOW = 1_800_000_000_000L;
    private AIChatDao dao;
    private AIChatResultService service;

    @BeforeEach
    void setUp() {
        dao = mock(AIChatDao.class);
        service = new AIChatResultService(dao, Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC));
    }

    @Test
    void successFinalizesTheExactPendingAssistantMessage() throws Exception {
        when(dao.findJob("user", "job")).thenReturn(Optional.of(job()));
        when(dao.finalizeMessage("user", "conversation", "job", "assistant",
                AIChatJob.Status.SUCCEEDED, "Giải thích", null, NOW)).thenReturn(true);

        assertTrue(service.handle(new AIChatResult("user", "conversation", "job", "assistant",
                AIChatResult.Status.SUCCEEDED, "Giải thích", null)));

        verify(dao).finalizeMessage("user", "conversation", "job", "assistant",
                AIChatJob.Status.SUCCEEDED, "Giải thích", null, NOW);
    }

    @Test
    void failureNormalizesBlankErrorToAiUnavailable() throws Exception {
        when(dao.findJob("user", "job")).thenReturn(Optional.of(job()));
        when(dao.finalizeMessage("user", "conversation", "job", "assistant",
                AIChatJob.Status.FAILED, null, "AI_UNAVAILABLE", NOW)).thenReturn(true);

        assertTrue(service.handle(new AIChatResult("user", "conversation", "job", "assistant",
                AIChatResult.Status.FAILED, null, " ")));
    }

    @Test
    void mismatchedConversationOrAssistantIdentifierIsIgnored() throws Exception {
        when(dao.findJob("user", "job")).thenReturn(Optional.of(job()));

        assertFalse(service.handle(new AIChatResult("user", "other", "job", "assistant",
                AIChatResult.Status.SUCCEEDED, "answer", null)));
        assertFalse(service.handle(new AIChatResult("user", "conversation", "job", "other",
                AIChatResult.Status.SUCCEEDED, "answer", null)));

        verify(dao, never()).finalizeMessage(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void absentOrForeignJobDoesNotDiscloseOrFinalize() throws Exception {
        when(dao.findJob("foreign", "job")).thenReturn(Optional.empty());

        assertFalse(service.handle(new AIChatResult("foreign", "conversation", "job", "assistant",
                AIChatResult.Status.SUCCEEDED, "answer", null)));
        verify(dao, never()).finalizeMessage(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void duplicateTerminalDeliveryReturnsFalseWithoutOverwriting() throws Exception {
        AIChatJob terminal = job();
        terminal.setStatus(AIChatJob.Status.SUCCEEDED);
        when(dao.findJob("user", "job")).thenReturn(Optional.of(terminal));

        assertFalse(service.handle(new AIChatResult("user", "conversation", "job", "assistant",
                AIChatResult.Status.FAILED, null, "AI_UNAVAILABLE")));
        verify(dao, never()).finalizeMessage(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void malformedSuccessIsRejectedBeforeDaoAccess() {
        assertThrows(IllegalArgumentException.class, () -> service.handle(new AIChatResult(
                "user", "conversation", "job", "assistant", AIChatResult.Status.SUCCEEDED, " ", null)));
        assertThrows(IllegalArgumentException.class, () -> service.handle(null));
        verifyNoInteractions(dao);
    }

    private AIChatJob job() {
        AIChatJob value = new AIChatJob();
        value.setId("job");
        value.setUserId("user");
        value.setConversationId("conversation");
        value.setAssistantMessageId("assistant");
        value.setStatus(AIChatJob.Status.PENDING);
        return value;
    }
}
