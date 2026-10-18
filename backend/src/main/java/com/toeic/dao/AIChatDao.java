package com.toeic.dao;

import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
import com.toeic.model.AIChatMessage;

import java.util.List;
import java.util.Optional;

public interface AIChatDao {
    AIChatConversation createConversation(AIChatConversation conversation, int maxActive) throws Exception;

    Optional<AIChatConversation> findConversation(String userId, String conversationId) throws Exception;

    /** Active, owned conversations in most-recently-active order. */
    List<AIChatConversation> listConversations(String userId, int limit) throws Exception;

    /** The newest limit messages, returned in chronological order. Deleted/foreign resources are 404. */
    List<AIChatMessage> listMessages(String userId, String conversationId, int limit) throws Exception;

    /** Repeating an owned deletion is a no-op; messages and jobs are retained. */
    void softDeleteConversation(String userId, String conversationId, long now) throws Exception;

    /** Renames an active owned conversation. Foreign, deleted, and missing resources are 404. */
    AIChatConversation renameConversation(String userId, String conversationId, String title, long now) throws Exception;

    /**
     * All reads, quota checks, and message/job/usage writes occur in one transaction.
     * Keys are unique per user. Reuse with different content or conversation is CHAT_MESSAGE_INVALID.
     * now and configurable limits are supplied by the trusted application service, never the client.
     * Admission time is max(now, the user's last persisted admission time); daily quota/reset and
     * message timestamps use that monotonic time. Burst state is shared across conversations and days.
     */
    AcceptedChatMessage acceptMessage(String userId, String conversationId, String content,
            String idempotencyKey, long now, int dailyLimit, int burstLimit) throws Exception;

    Optional<AIChatJob> findJob(String userId, String jobId) throws Exception;

    /**
     * Thử lại một assistant message đang FAILED mà không trừ quota: reset message về PENDING,
     * gắn job mới (id mới) vào cặp user/assistant message đã có, rồi trả về aggregate.
     * Nếu đã có retry job cho message này mà vẫn chưa terminal thì trả về job đó với
     * newlyAccepted=false và không tạo job mới.
     * now và dailyLimit do application service tin cậy cung cấp, không lấy từ client.
     */
    AcceptedChatMessage retryFailedMessage(String userId, String conversationId, String assistantMessageId,
            long now, int dailyLimit) throws Exception;

    /** First terminal delivery wins. False means missing, deleted, mismatched, or already terminal. */
    boolean finalizeMessage(String userId, String conversationId, String jobId, String assistantMessageId,
            AIChatJob.Status status, String content, String errorCode, long completedAt) throws Exception;

    record QuotaSummary(int dailyLimit, int remainingDaily, long nextResetAt) {}

    record AcceptedChatMessage(AIChatConversation conversation, AIChatMessage userMessage,
            AIChatMessage assistantMessage, AIChatJob job, QuotaSummary quotaSummary, boolean newlyAccepted) {}
}
