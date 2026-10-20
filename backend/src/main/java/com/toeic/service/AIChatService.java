package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.AIChatDao;
import com.toeic.dto.CreateChatConversationRequest;
import com.toeic.dto.RenameChatConversationRequest;
import com.toeic.dto.SendChatMessageRequest;
import com.toeic.dto.ai.AIChatQuestionContext;
import com.toeic.dto.ai.AIChatRequest;
import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
import com.toeic.model.AIChatMessage;
import com.toeic.model.enums.Entitlement;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AIChatService {
    private static final Set<String> SUPPORTED_LOCALES = Set.of("vi", "en");
    private static final int MAX_IDEMPOTENCY_KEY_LENGTH = 128;
    private static final int MAX_TITLE_CODE_POINTS = 60;

    private final AIChatDao chatDao;
    private final SubscriptionService subscriptionService;
    private final ChatAttemptContextService contextService;
    private final AIChatRequestPublisher requestPublisher;
    private final Clock clock;
    private final int dailyLimit;
    private final int burstLimit;
    private final int conversationLimit;
    private final int readLimit;
    private final int messageCharacterLimit;
    private final int historyMessageLimit;

    @Autowired
    public AIChatService(
            AIChatDao chatDao,
            SubscriptionService subscriptionService,
            ChatAttemptContextService contextService,
            AIChatRequestPublisher requestPublisher,
            @Value("${app.ai.chat.daily-limit:30}") int dailyLimit,
            @Value("${app.ai.chat.burst-limit:5}") int burstLimit,
            @Value("${app.ai.chat.conversation-limit:10}") int conversationLimit,
            @Value("${app.ai.chat.read-limit:100}") int readLimit,
            @Value("${app.ai.chat.message-character-limit:1000}") int messageCharacterLimit,
            @Value("${app.ai.chat.history-message-limit:12}") int historyMessageLimit
    ) {
        this(chatDao, subscriptionService, contextService, requestPublisher, Clock.systemUTC(),
                dailyLimit, burstLimit, conversationLimit, readLimit, messageCharacterLimit, historyMessageLimit);
    }

    public AIChatService(
            AIChatDao chatDao,
            SubscriptionService subscriptionService,
            ChatAttemptContextService contextService,
            AIChatRequestPublisher requestPublisher,
            Clock clock,
            int dailyLimit,
            int burstLimit,
            int conversationLimit,
            int readLimit,
            int messageCharacterLimit,
            int historyMessageLimit
    ) {
        this.chatDao = chatDao;
        this.subscriptionService = subscriptionService;
        this.contextService = contextService;
        this.requestPublisher = requestPublisher;
        this.clock = clock;
        this.dailyLimit = positive(dailyLimit, "dailyLimit");
        this.burstLimit = positive(burstLimit, "burstLimit");
        this.conversationLimit = positive(conversationLimit, "conversationLimit");
        this.readLimit = positive(readLimit, "readLimit");
        this.messageCharacterLimit = positive(messageCharacterLimit, "messageCharacterLimit");
        this.historyMessageLimit = positive(historyMessageLimit, "historyMessageLimit");
    }

    public AIChatConversation createConversation(String userId, CreateChatConversationRequest request) throws Exception {
        ValidatedContext validated = validateConversationRequest(request);
        subscriptionService.requireEntitlement(userId, Entitlement.AI_CHAT);
        if (validated.attemptId() != null) {
            contextService.resolve(userId, validated.attemptId(), validated.questionNumber());
        }

        long now = clock.millis();
        AIChatConversation conversation = new AIChatConversation();
        conversation.setId(UUID.randomUUID().toString());
        conversation.setUserId(userId);
        conversation.setLocale(validated.locale());
        conversation.setTitle("vi".equals(validated.locale()) ? "Hội thoại TOEIC mới" : "New TOEIC conversation");
        conversation.setContextAttemptId(validated.attemptId());
        conversation.setContextQuestionNumber(validated.questionNumber());
        conversation.setStatus(AIChatConversation.Status.ACTIVE);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setLastMessageAt(now);
        return chatDao.createConversation(conversation, conversationLimit);
    }

    public List<AIChatConversation> listConversations(String userId) throws Exception {
        return chatDao.listConversations(userId, readLimit);
    }

    public ConversationDetail getConversation(String userId, String conversationId) throws Exception {
        AIChatConversation conversation = ownedConversation(userId, conversationId);
        return new ConversationDetail(conversation, chatDao.listMessages(userId, conversationId, readLimit));
    }

    public AIChatDao.AcceptedChatMessage sendMessage(
            String userId, String conversationId, SendChatMessageRequest request
    ) throws Exception {
        ValidatedMessage validated = validateMessage(request);
        subscriptionService.requireEntitlement(userId, Entitlement.AI_CHAT);
        AIChatConversation conversation = ownedConversation(userId, conversationId);
        AIChatQuestionContext questionContext = null;
        if (conversation.getContextAttemptId() != null) {
            questionContext = contextService.resolve(
                    userId, conversation.getContextAttemptId(), conversation.getContextQuestionNumber());
        }
        AIChatDao.AcceptedChatMessage accepted = chatDao.acceptMessage(
                userId, conversationId, validated.content(), validated.idempotencyKey(),
                clock.millis(), dailyLimit, burstLimit);
        if (!accepted.newlyAccepted()) return accepted;

        try {
            List<AIChatRequest.HistoryMessage> history = historyForRequest(
                    chatDao.listMessages(userId, conversationId, readLimit), accepted.userMessage().getId());
            AIChatRequest generationRequest = new AIChatRequest(
                    userId, conversationId, accepted.job().getId(), accepted.userMessage().getId(),
                    accepted.assistantMessage().getId(), conversation.getLocale(), history,
                    validated.content(), questionContext);
            requestPublisher.publish(generationRequest);
        } catch (Exception postAdmissionFailure) {
            try {
                chatDao.finalizeMessage(userId, conversationId, accepted.job().getId(),
                        accepted.assistantMessage().getId(), AIChatJob.Status.FAILED,
                        null, "AI_UNAVAILABLE", clock.millis());
            } catch (Exception finalizeFailure) {
                postAdmissionFailure.addSuppressed(finalizeFailure);
            }
            ApiCodeException unavailable = new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI_UNAVAILABLE", "AI chat is temporarily unavailable");
            unavailable.initCause(postAdmissionFailure);
            throw unavailable;
        }
        return accepted;
    }

    /**
     * Thử lại một assistant message đang FAILED: tái dùng cặp message cũ, tạo job mới,
     * KHÔNG trừ quota. Nếu lượt retry đã được chấp nhận mà job vẫn PENDING (double-click
     * hoặc mất response) thì publish lại job đó — ai-service dedup theo jobId nên an toàn.
     */
    public AIChatDao.AcceptedChatMessage retryMessage(
            String userId, String conversationId, String assistantMessageId
    ) throws Exception {
        requireIdentifier(assistantMessageId);
        subscriptionService.requireEntitlement(userId, Entitlement.AI_CHAT);
        AIChatConversation conversation = ownedConversation(userId, conversationId);
        AIChatQuestionContext questionContext = null;
        if (conversation.getContextAttemptId() != null) {
            questionContext = contextService.resolve(
                    userId, conversation.getContextAttemptId(), conversation.getContextQuestionNumber());
        }
        AIChatDao.AcceptedChatMessage retried = chatDao.retryFailedMessage(
                userId, conversationId, assistantMessageId, clock.millis(), dailyLimit);

        try {
            List<AIChatRequest.HistoryMessage> history = historyForRequest(
                    chatDao.listMessages(userId, conversationId, readLimit), retried.userMessage().getId());
            AIChatRequest generationRequest = new AIChatRequest(
                    userId, conversationId, retried.job().getId(), retried.userMessage().getId(),
                    retried.assistantMessage().getId(), conversation.getLocale(), history,
                    retried.userMessage().getContent(), questionContext);
            requestPublisher.publish(generationRequest);
        } catch (Exception postAdmissionFailure) {
            try {
                chatDao.finalizeMessage(userId, conversationId, retried.job().getId(),
                        retried.assistantMessage().getId(), AIChatJob.Status.FAILED,
                        null, "AI_UNAVAILABLE", clock.millis());
            } catch (Exception finalizeFailure) {
                postAdmissionFailure.addSuppressed(finalizeFailure);
            }
            ApiCodeException unavailable = new ApiCodeException(HttpStatus.SERVICE_UNAVAILABLE,
                    "AI_UNAVAILABLE", "AI chat is temporarily unavailable");
            unavailable.initCause(postAdmissionFailure);
            throw unavailable;
        }
        return retried;
    }

    public void deleteConversation(String userId, String conversationId) throws Exception {
        requireIdentifier(conversationId);
        subscriptionService.requireEntitlement(userId, Entitlement.AI_CHAT);
        chatDao.softDeleteConversation(userId, conversationId, clock.millis());
    }

    public AIChatConversation renameConversation(
            String userId, String conversationId, RenameChatConversationRequest request
    ) throws Exception {
        requireIdentifier(conversationId);
        String title = validateTitle(request);
        subscriptionService.requireEntitlement(userId, Entitlement.AI_CHAT);
        return chatDao.renameConversation(userId, conversationId, title, clock.millis());
    }

    public AIChatJob getJob(String userId, String jobId) throws Exception {
        requireIdentifier(jobId);
        return chatDao.findJob(userId, jobId).orElseThrow(AIChatService::notFound);
    }

    private AIChatConversation ownedConversation(String userId, String conversationId) throws Exception {
        requireIdentifier(conversationId);
        return chatDao.findConversation(userId, conversationId).orElseThrow(AIChatService::notFound);
    }

    private List<AIChatRequest.HistoryMessage> historyForRequest(
            List<AIChatMessage> messages, String currentUserMessageId
    ) {
        List<AIChatRequest.HistoryMessage> successful = messages.stream()
                .filter(message -> message.getStatus() == AIChatMessage.Status.SUCCEEDED)
                .filter(message -> message.getContent() != null && !message.getContent().isBlank())
                .filter(message -> !message.getId().equals(currentUserMessageId))
                .map(message -> new AIChatRequest.HistoryMessage(message.getRole().name(), message.getContent()))
                .toList();
        int from = Math.max(0, successful.size() - historyMessageLimit);
        return List.copyOf(successful.subList(from, successful.size()));
    }

    private ValidatedContext validateConversationRequest(CreateChatConversationRequest request) {
        if (request == null) throw contextInvalid();
        String locale = request.locale() == null ? "vi" : request.locale().trim().toLowerCase(Locale.ROOT);
        if (!SUPPORTED_LOCALES.contains(locale)) throw contextInvalid();
        String attemptId = trimToNull(request.attemptId());
        boolean hasAttempt = attemptId != null;
        boolean hasQuestion = request.questionNumber() != null;
        if (hasAttempt != hasQuestion || (hasQuestion && request.questionNumber() < 1)) throw contextInvalid();
        return new ValidatedContext(locale, attemptId, request.questionNumber());
    }

    private ValidatedMessage validateMessage(SendChatMessageRequest request) {
        if (request == null) throw messageInvalid();
        String content = request.content() == null ? null : request.content().trim();
        String key = request.idempotencyKey();
        if (content == null || content.isEmpty()
                || content.codePointCount(0, content.length()) > messageCharacterLimit
                || key == null || key.isBlank() || !key.equals(key.trim())
                || key.length() > MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw messageInvalid();
        }
        return new ValidatedMessage(content, key);
    }

    private String validateTitle(RenameChatConversationRequest request) {
        if (request == null || request.title() == null) throw titleInvalid();
        String title = request.title().strip().replaceAll("[\\s\\p{Z}]+", " ");
        if (title.isEmpty() || title.codePointCount(0, title.length()) > MAX_TITLE_CODE_POINTS) {
            throw titleInvalid();
        }
        return title;
    }

    private void requireIdentifier(String value) {
        if (value == null || value.isBlank() || value.length() > 256) throw notFound();
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static int positive(int value, String name) {
        if (value < 1) throw new IllegalArgumentException(name + " must be positive");
        return value;
    }

    private static ApiCodeException contextInvalid() {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "CHAT_CONTEXT_INVALID", "Chat context is invalid");
    }

    private static ApiCodeException messageInvalid() {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "CHAT_MESSAGE_INVALID", "Chat message is invalid");
    }

    private static ApiCodeException titleInvalid() {
        return new ApiCodeException(HttpStatus.BAD_REQUEST, "CHAT_TITLE_INVALID", "Chat title is invalid");
    }

    private static ApiCodeException notFound() {
        return new ApiCodeException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Chat resource not found");
    }

    public record ConversationDetail(AIChatConversation conversation, List<AIChatMessage> messages) {
        public ConversationDetail {
            messages = List.copyOf(messages);
        }
    }

    private record ValidatedContext(String locale, String attemptId, Integer questionNumber) {
    }

    private record ValidatedMessage(String content, String idempotencyKey) {
    }
}
