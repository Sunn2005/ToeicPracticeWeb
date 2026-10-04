package com.toeic.service;

import com.toeic.dao.AIChatDao;
import com.toeic.dto.ai.AIChatResult;
import com.toeic.model.AIChatJob;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;

@Service
public class AIChatResultService {
    private final AIChatDao chatDao;
    private final Clock clock;

    @Autowired
    public AIChatResultService(AIChatDao chatDao) {
        this(chatDao, Clock.systemUTC());
    }

    public AIChatResultService(AIChatDao chatDao, Clock clock) {
        this.chatDao = chatDao;
        this.clock = clock;
    }

    public boolean handle(AIChatResult result) throws Exception {
        validate(result);
        AIChatJob job = chatDao.findJob(result.userId(), result.jobId()).orElse(null);
        if (job == null || job.getStatus() != AIChatJob.Status.PENDING
                || !result.conversationId().equals(job.getConversationId())
                || !result.assistantMessageId().equals(job.getAssistantMessageId())) {
            return false;
        }

        AIChatJob.Status status = AIChatJob.Status.valueOf(result.status().name());
        String content = status == AIChatJob.Status.SUCCEEDED ? result.answer().trim() : null;
        String errorCode = status == AIChatJob.Status.FAILED
                ? normalizeError(result.errorCode()) : null;
        return chatDao.finalizeMessage(result.userId(), result.conversationId(), result.jobId(),
                result.assistantMessageId(), status, content, errorCode, clock.millis());
    }

    private void validate(AIChatResult result) {
        if (result == null || blank(result.userId()) || blank(result.conversationId())
                || blank(result.jobId()) || blank(result.assistantMessageId()) || result.status() == null
                || (result.status() == AIChatResult.Status.SUCCEEDED && blank(result.answer()))) {
            throw new IllegalArgumentException("Invalid AI chat result");
        }
    }

    private String normalizeError(String value) {
        return blank(value) ? "AI_UNAVAILABLE" : value.trim();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
