package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.Transaction;
import com.toeic.controller.ApiCodeException;
import com.toeic.dao.AIChatDao;
import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
import com.toeic.model.AIChatMessage;
import com.toeic.model.AIChatQuota;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Repository
public class FirestoreAIChatDao implements AIChatDao {
    private static final ZoneId QUOTA_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final Firestore firestore;

    public FirestoreAIChatDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public AIChatConversation createConversation(AIChatConversation conversation, int maxActive) throws Exception {
        positive(maxActive);
        if (conversation.getStatus() != AIChatConversation.Status.ACTIVE) {
            throw new IllegalArgumentException("A new conversation must be active");
        }
        var reference = conversationRef(conversation.getId());
        var guard = conversationGuard(conversation.getUserId());
        return transact(transaction -> {
            var existing = conversationFrom(transaction.get(reference).get());
            if (existing != null) {
                throw new ApiCodeException(HttpStatus.CONFLICT, "CONFLICT", "Conversation already exists");
            }
            long count = activeCount(transaction, guard, conversation.getUserId());
            if (count >= maxActive) {
                throw new ApiCodeException(HttpStatus.CONFLICT, "CONVERSATION_LIMIT_REACHED", "Active conversation limit reached");
            }
            transaction.set(reference, conversation);
            transaction.set(guard, Map.of("userId", conversation.getUserId(), "activeConversationCount", count + 1));
            return conversation;
        });
    }

    @Override
    public Optional<AIChatConversation> findConversation(String userId, String conversationId) throws Exception {
        var conversation = conversationFrom(conversationRef(conversationId).get().get());
        return activeOwned(conversation, userId) ? Optional.of(conversation) : Optional.empty();
    }

    @Override
    public List<AIChatConversation> listConversations(String userId, int limit) throws Exception {
        positive(limit);
        List<AIChatConversation> result = new ArrayList<>();
        for (var snapshot : activeConversations(userId).orderBy("lastMessageAt", Query.Direction.DESCENDING)
                .limit(limit).get().get().getDocuments()) {
            var conversation = conversationFrom(snapshot);
            if (activeOwned(conversation, userId)) result.add(conversation);
        }
        return List.copyOf(result);
    }

    @Override
    public List<AIChatMessage> listMessages(String userId, String conversationId, int limit) throws Exception {
        positive(limit);
        findConversation(userId, conversationId).orElseThrow(FirestoreAIChatDao::notFound);
        List<AIChatMessage> result = new ArrayList<>();
        for (var snapshot : conversationRef(conversationId).collection("messages")
                .orderBy("createdAt", Query.Direction.DESCENDING).limit(limit).get().get().getDocuments()) {
            var message = messageFrom(snapshot);
            if (message != null) result.add(message);
        }
        result.sort(Comparator.comparing(AIChatMessage::getCreatedAt).thenComparing(AIChatMessage::getId));
        return List.copyOf(result);
    }

    @Override
    public void softDeleteConversation(String userId, String conversationId, long now) throws Exception {
        var reference = conversationRef(conversationId);
        var guard = conversationGuard(userId);
        transact(transaction -> {
            var conversation = conversationFrom(transaction.get(reference).get());
            if (conversation == null || !Objects.equals(userId, conversation.getUserId())) throw notFound();
            if (conversation.getStatus() == AIChatConversation.Status.DELETED) return null;
            long count = activeCount(transaction, guard, userId);
            conversation.setStatus(AIChatConversation.Status.DELETED);
            conversation.setUpdatedAt(now);
            transaction.set(reference, conversation);
            transaction.set(guard, Map.of("userId", userId, "activeConversationCount", Math.max(0, count - 1)));
            return null;
        });
    }

    @Override
    public AcceptedChatMessage acceptMessage(String userId, String conversationId, String content,
            String idempotencyKey, long now, int dailyLimit, int burstLimit) throws Exception {
        positive(dailyLimit);
        positive(burstLimit);
        var conversationReference = conversationRef(conversationId);
        // Deterministic identifiers are computed outside the retriable callback; no random or transport side effects.
        String jobId = idempotencyId(userId, idempotencyKey);
        var jobReference = jobRef(jobId);
        var burstReference = firestore.collection("aiChatUsage").document(userId + "_burst");
        return transact(transaction -> {
            var conversation = conversationFrom(transaction.get(conversationReference).get());
            if (!activeOwned(conversation, userId)) throw notFound();
            var existingJob = jobFrom(transaction.get(jobReference).get());
            var burst = transaction.get(burstReference).get();
            Long lastAdmissionAt = burst.getLong("lastAdmissionAt");
            // Shared state serializes every conversation and day. Older sampled times cannot move admission backward.
            long admissionAt = lastAdmissionAt == null ? now : Math.max(now, lastAdmissionAt);
            LocalDate date = Instant.ofEpochMilli(admissionAt).atZone(QUOTA_ZONE).toLocalDate();
            var usageReference = usageRef(userId, date);
            long resetAt = date.plusDays(1).atStartOfDay(QUOTA_ZONE).toInstant().toEpochMilli();
            var quota = quotaFrom(transaction.get(usageReference).get(), userId, date, resetAt);
            if (existingJob != null) {
                if (!Objects.equals(userId, existingJob.getUserId())
                        || !Objects.equals(conversationId, existingJob.getConversationId())
                        || !Objects.equals(idempotencyKey, existingJob.getIdempotencyKey())) throw invalidReuse();
                var userMessage = messageFrom(transaction.get(messageRef(conversationId, existingJob.getUserMessageId())).get());
                var assistantMessage = messageFrom(transaction.get(messageRef(conversationId, existingJob.getAssistantMessageId())).get());
                if (userMessage == null || assistantMessage == null || !Objects.equals(content, userMessage.getContent())) throw invalidReuse();
                return new AcceptedChatMessage(conversation, userMessage, assistantMessage, existingJob,
                        summary(quota, dailyLimit), false);
            }
            if (quota.getAcceptedCount() >= dailyLimit) {
                throw new ApiCodeException(HttpStatus.TOO_MANY_REQUESTS, "CHAT_DAILY_LIMIT_REACHED", "Daily chat quota exhausted");
            }
            List<Long> recent = recentAdmissions(burst, admissionAt);
            if (recent.size() >= burstLimit) {
                throw new ApiCodeException(HttpStatus.TOO_MANY_REQUESTS, "CHAT_RATE_LIMITED", "Rolling minute chat limit reached");
            }
            recent.add(admissionAt);
            quota.setAcceptedCount(quota.getAcceptedCount() + 1);
            List<Long> dailyRecent = new ArrayList<>(quota.getAcceptedTimestamps().stream()
                    .filter(time -> time > admissionAt - 60_000).toList());
            dailyRecent.add(admissionAt);
            quota.setAcceptedTimestamps(dailyRecent);
            var userMessage = newMessage(jobId + "_0", AIChatMessage.Role.USER, content, AIChatMessage.Status.SUCCEEDED, jobId, admissionAt);
            userMessage.setCompletedAt(admissionAt);
            var assistantMessage = newMessage(jobId + "_1", AIChatMessage.Role.ASSISTANT, null, AIChatMessage.Status.PENDING, jobId, admissionAt);
            var job = new AIChatJob();
            job.setId(jobId);
            job.setUserId(userId);
            job.setConversationId(conversationId);
            job.setUserMessageId(userMessage.getId());
            job.setAssistantMessageId(assistantMessage.getId());
            job.setIdempotencyKey(idempotencyKey);
            job.setStatus(AIChatJob.Status.PENDING);
            job.setCreatedAt(admissionAt);
            job.setUpdatedAt(admissionAt);
            conversation.setUpdatedAt(Math.max(conversation.getUpdatedAt(), admissionAt));
            conversation.setLastMessageAt(Math.max(conversation.getLastMessageAt(), admissionAt));
            transaction.set(messageRef(conversationId, userMessage.getId()), userMessage);
            transaction.set(messageRef(conversationId, assistantMessage.getId()), assistantMessage);
            transaction.set(jobReference, job);
            transaction.set(usageReference, quota);
            transaction.set(burstReference, Map.of("userId", userId, "lastAdmissionAt", admissionAt, "acceptedTimestamps", recent));
            transaction.set(conversationReference, conversation);
            return new AcceptedChatMessage(conversation, userMessage, assistantMessage, job, summary(quota, dailyLimit), true);
        });
    }

    @Override
    public Optional<AIChatJob> findJob(String userId, String jobId) throws Exception {
        var job = jobFrom(jobRef(jobId).get().get());
        if (job == null || !Objects.equals(userId, job.getUserId())
                || findConversation(userId, job.getConversationId()).isEmpty()) return Optional.empty();
        return Optional.of(job);
    }

    @Override
    public boolean finalizeMessage(String userId, String conversationId, String jobId, String assistantMessageId,
            AIChatJob.Status status, String content, String errorCode, long completedAt) throws Exception {
        if (status != AIChatJob.Status.SUCCEEDED && status != AIChatJob.Status.FAILED) {
            throw new IllegalArgumentException("Final status must be terminal");
        }
        var jobReference = jobRef(jobId);
        var assistantReference = messageRef(conversationId, assistantMessageId);
        var conversationReference = conversationRef(conversationId);
        return transact(transaction -> {
            var job = jobFrom(transaction.get(jobReference).get());
            if (job == null || !Objects.equals(userId, job.getUserId())
                    || !Objects.equals(conversationId, job.getConversationId())
                    || !Objects.equals(assistantMessageId, job.getAssistantMessageId())
                    || job.getStatus() != AIChatJob.Status.PENDING) return false;
            var conversation = conversationFrom(transaction.get(conversationReference).get());
            if (!activeOwned(conversation, userId)) return false;
            var assistant = messageFrom(transaction.get(assistantReference).get());
            if (assistant == null || !Objects.equals(jobId, assistant.getJobId())
                    || assistant.getRole() != AIChatMessage.Role.ASSISTANT
                    || assistant.getStatus() != AIChatMessage.Status.PENDING) return false;
            assistant.setStatus(AIChatMessage.Status.valueOf(status.name()));
            assistant.setContent(status == AIChatJob.Status.SUCCEEDED ? content : null);
            assistant.setErrorCode(status == AIChatJob.Status.FAILED ? errorCode : null);
            assistant.setCompletedAt(completedAt);
            job.setStatus(status);
            job.setErrorCode(assistant.getErrorCode());
            job.setUpdatedAt(completedAt);
            job.setCompletedAt(completedAt);
            conversation.setUpdatedAt(Math.max(conversation.getUpdatedAt(), completedAt));
            conversation.setLastMessageAt(Math.max(conversation.getLastMessageAt(), completedAt));
            transaction.set(assistantReference, assistant);
            transaction.set(jobReference, job);
            transaction.set(conversationReference, conversation);
            return true;
        });
    }

    @Override
    public AcceptedChatMessage retryFailedMessage(String userId, String conversationId, String assistantMessageId,
            long now, int dailyLimit) throws Exception {
        positive(dailyLimit);
        var conversationReference = conversationRef(conversationId);
        var assistantReference = messageRef(conversationId, assistantMessageId);
        return transact(transaction -> {
            var conversation = conversationFrom(transaction.get(conversationReference).get());
            if (!activeOwned(conversation, userId)) throw notFound();
            var assistant = messageFrom(transaction.get(assistantReference).get());
            if (assistant == null || assistant.getRole() != AIChatMessage.Role.ASSISTANT) throw notFound();
            if (assistant.getStatus() == AIChatMessage.Status.SUCCEEDED) throw invalidRetry();
            if (assistant.getJobId() == null) throw invalidRetry();
            var job = jobFrom(transaction.get(jobRef(assistant.getJobId())).get());
            if (assistant.getStatus() == AIChatMessage.Status.PENDING) {
                // Một lượt retry đã được chấp nhận và job vẫn đang chạy: trả về job đó
                // thay vì tạo job mới (chống double-click / mất response).
                if (job == null || job.getStatus() != AIChatJob.Status.PENDING
                        || !Objects.equals(userId, job.getUserId())
                        || !Objects.equals(conversationId, job.getConversationId())
                        || !Objects.equals(assistantMessageId, job.getAssistantMessageId())) throw invalidRetry();
                var userMessage = messageFrom(transaction.get(messageRef(conversationId, job.getUserMessageId())).get());
                if (userMessage == null) throw invalidRetry();
                return new AcceptedChatMessage(conversation, userMessage, assistant, job,
                        currentSummary(transaction, userId, now, dailyLimit), false);
            }
            // FAILED: tạo job mới gắn vào cặp message cũ. Retry không trừ quota.
            if (job == null || job.getStatus() != AIChatJob.Status.FAILED
                    || !Objects.equals(userId, job.getUserId())
                    || !Objects.equals(conversationId, job.getConversationId())
                    || !Objects.equals(assistantMessageId, job.getAssistantMessageId())) throw invalidRetry();
            var userMessage = messageFrom(transaction.get(messageRef(conversationId, job.getUserMessageId())).get());
            if (userMessage == null || userMessage.getRole() != AIChatMessage.Role.USER) throw invalidRetry();
            var retryJob = new AIChatJob();
            retryJob.setId(UUID.randomUUID().toString());
            retryJob.setUserId(userId);
            retryJob.setConversationId(conversationId);
            retryJob.setUserMessageId(userMessage.getId());
            retryJob.setAssistantMessageId(assistant.getId());
            retryJob.setIdempotencyKey("retry:" + job.getId());
            retryJob.setStatus(AIChatJob.Status.PENDING);
            retryJob.setCreatedAt(now);
            retryJob.setUpdatedAt(now);
            assistant.setStatus(AIChatMessage.Status.PENDING);
            assistant.setJobId(retryJob.getId());
            assistant.setErrorCode(null);
            assistant.setCompletedAt(null);
            conversation.setUpdatedAt(Math.max(conversation.getUpdatedAt(), now));
            conversation.setLastMessageAt(Math.max(conversation.getLastMessageAt(), now));
            transaction.set(assistantReference, assistant);
            transaction.set(jobRef(retryJob.getId()), retryJob);
            transaction.set(conversationReference, conversation);
            return new AcceptedChatMessage(conversation, userMessage, assistant, retryJob,
                    currentSummary(transaction, userId, now, dailyLimit), true);
        });
    }

    private Query activeConversations(String userId) {
        return firestore.collection("aiChatConversations").whereEqualTo("userId", userId).whereEqualTo("status", "ACTIVE");
    }

    private long activeCount(Transaction transaction, DocumentReference guard, String userId) throws Exception {
        var snapshot = transaction.get(guard).get();
        Long count = snapshot.getLong("activeConversationCount");
        if (count != null) return count;
        return transaction.get(activeConversations(userId)).get().getDocuments().size();
    }

    private DocumentReference conversationRef(String id) {
        return firestore.collection("aiChatConversations").document(id);
    }

    private DocumentReference messageRef(String conversationId, String messageId) {
        return conversationRef(conversationId).collection("messages").document(messageId);
    }

    private DocumentReference jobRef(String jobId) {
        return firestore.collection("aiChatJobs").document(jobId);
    }

    /** Dedicated shared guard prevents concurrent creates/deletes from exceeding the cap, including across midnight. */
    private DocumentReference conversationGuard(String userId) {
        return firestore.collection("aiChatUsage").document(userId + "_conversations");
    }

    private DocumentReference usageRef(String userId, LocalDate date) {
        return firestore.collection("aiChatUsage").document(userId + "_" + date);
    }

    private static AIChatConversation conversationFrom(DocumentSnapshot snapshot) {
        if (!snapshot.exists()) return null;
        var conversation = snapshot.toObject(AIChatConversation.class);
        if (conversation != null) conversation.setId(snapshot.getId());
        return conversation;
    }

    private static AIChatMessage messageFrom(DocumentSnapshot snapshot) {
        if (!snapshot.exists()) return null;
        var message = snapshot.toObject(AIChatMessage.class);
        if (message != null) message.setId(snapshot.getId());
        return message;
    }

    private static AIChatJob jobFrom(DocumentSnapshot snapshot) {
        if (!snapshot.exists()) return null;
        var job = snapshot.toObject(AIChatJob.class);
        if (job != null) job.setId(snapshot.getId());
        return job;
    }

    private static AIChatQuota quotaFrom(DocumentSnapshot snapshot, String userId, LocalDate date, long resetAt) {
        var quota = snapshot.exists() ? snapshot.toObject(AIChatQuota.class) : new AIChatQuota();
        quota.setUserId(userId);
        quota.setDate(date.toString());
        quota.setNextResetAt(resetAt);
        if (quota.getAcceptedCount() == null) quota.setAcceptedCount(0);
        if (quota.getAcceptedTimestamps() == null) quota.setAcceptedTimestamps(List.of());
        return quota;
    }

    private static AIChatMessage newMessage(String id, AIChatMessage.Role role, String content,
            AIChatMessage.Status status, String jobId, long now) {
        var message = new AIChatMessage();
        message.setId(id);
        message.setRole(role);
        message.setContent(content);
        message.setStatus(status);
        message.setJobId(jobId);
        message.setCreatedAt(now);
        return message;
    }

    private static QuotaSummary summary(AIChatQuota quota, int dailyLimit) {
        return new QuotaSummary(dailyLimit, Math.max(0, dailyLimit - quota.getAcceptedCount()), quota.getNextResetAt());
    }

    /** Đọc quota hiện tại của ngày (theo giờ VN) mà không ghi gì thêm — dùng cho retry vì retry không trừ quota. */
    private QuotaSummary currentSummary(Transaction transaction, String userId, long now, int dailyLimit) throws Exception {
        LocalDate date = Instant.ofEpochMilli(now).atZone(QUOTA_ZONE).toLocalDate();
        long resetAt = date.plusDays(1).atStartOfDay(QUOTA_ZONE).toInstant().toEpochMilli();
        var quota = quotaFrom(transaction.get(usageRef(userId, date)).get(), userId, date, resetAt);
        return summary(quota, dailyLimit);
    }

    private static List<Long> recentAdmissions(DocumentSnapshot snapshot, long admissionAt) {
        List<Long> recent = new ArrayList<>();
        if (!snapshot.exists()) return recent;
        var data = snapshot.getData();
        if (data == null || !(data.get("acceptedTimestamps") instanceof List<?> timestamps)) {
            throw new IllegalStateException("Invalid chat burst state");
        }
        for (Object timestamp : timestamps) {
            if (!(timestamp instanceof Number number)) throw new IllegalStateException("Invalid chat burst timestamp");
            long time = number.longValue();
            if (time > admissionAt - 60_000) recent.add(time);
        }
        return recent;
    }

    private static boolean activeOwned(AIChatConversation conversation, String userId) {
        return conversation != null && Objects.equals(userId, conversation.getUserId())
                && conversation.getStatus() == AIChatConversation.Status.ACTIVE;
    }

    private static String idempotencyId(String userId, String key) throws Exception {
        // Length prefix prevents ambiguous concatenation and SHA-256 allows keys that cannot be document IDs.
        byte[] bytes = (userId.length() + ":" + userId + key).getBytes(StandardCharsets.UTF_8);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static void positive(int value) {
        if (value < 1) throw new IllegalArgumentException("Limit must be positive");
    }

    private static ApiCodeException notFound() {
        return new ApiCodeException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Chat resource not found");
    }

    private static ApiCodeException invalidReuse() {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "CHAT_MESSAGE_INVALID", "Idempotency key does not match the accepted message");
    }

    private static ApiCodeException invalidRetry() {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "CHAT_MESSAGE_INVALID", "Assistant message cannot be retried in its current state");
    }

    private <T> T transact(Transaction.Function<T> callback) throws Exception {
        try {
            return firestore.runTransaction(callback).get();
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof RuntimeException cause) throw cause;
            throw exception;
        }
    }
}
