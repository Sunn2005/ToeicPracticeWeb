package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.AIChatDao;
import com.toeic.dto.CreateChatConversationRequest;
import com.toeic.dto.RenameChatConversationRequest;
import com.toeic.dto.SendChatMessageRequest;
import com.toeic.dto.ai.AIChatRequest;
import com.toeic.dto.ai.AIChatQuestionContext;
import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
import com.toeic.model.AIChatMessage;
import com.toeic.model.enums.Entitlement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AIChatServiceTests {
    private static final long NOW = 1_800_000_000_000L;
    private AIChatDao dao;
    private SubscriptionService subscriptions;
    private ChatAttemptContextService contexts;
    private AIChatRequestPublisher publisher;
    private AIChatService service;

    @BeforeEach
    void setUp() {
        dao = mock(AIChatDao.class);
        subscriptions = mock(SubscriptionService.class);
        contexts = mock(ChatAttemptContextService.class);
        publisher = mock(AIChatRequestPublisher.class);
        service = new AIChatService(dao, subscriptions, contexts, publisher,
                Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC), 30, 5, 10, 100, 1_000, 12);
    }

    @Test
    void createRequiresAiChatEntitlementBeforeAttemptOrPersistence() throws Exception {
        doThrow(code("PRO_REQUIRED")).when(subscriptions).requireEntitlement("user", Entitlement.AI_CHAT);

        ApiCodeException error = assertThrows(ApiCodeException.class,
                () -> service.createConversation("user", new CreateChatConversationRequest("vi", null, null)));

        assertEquals("PRO_REQUIRED", error.getCode());
        verifyNoInteractions(contexts, dao);
    }

    @Test
    void createResolvesExactlyTheRequestedCompletedContext() throws Exception {
        AIChatQuestionContext context = context();
        when(contexts.resolve("user", "attempt", 101)).thenReturn(context);
        when(dao.createConversation(any(), eq(10))).thenAnswer(call -> call.getArgument(0));

        AIChatConversation created = service.createConversation(
                "user", new CreateChatConversationRequest("en", "attempt", 101));

        verify(contexts).resolve("user", "attempt", 101);
        assertEquals("user", created.getUserId());
        assertEquals("en", created.getLocale());
        assertEquals("attempt", created.getContextAttemptId());
        assertEquals(101, created.getContextQuestionNumber());
        assertEquals(AIChatConversation.Status.ACTIVE, created.getStatus());
        assertEquals(NOW, created.getCreatedAt());
    }

    @Test
    void createRejectsPartialContextAndUnsupportedLocaleWithoutWrites() {
        assertCode("CHAT_CONTEXT_INVALID", () -> service.createConversation(
                "user", new CreateChatConversationRequest("vi", "attempt", null)));
        assertCode("CHAT_CONTEXT_INVALID", () -> service.createConversation(
                "user", new CreateChatConversationRequest("fr", null, null)));
        verifyNoInteractions(subscriptions, contexts, dao);
    }

    @Test
    void createPropagatesConversationLimitFromAtomicDao() throws Exception {
        when(dao.createConversation(any(), eq(10))).thenThrow(code("CONVERSATION_LIMIT_REACHED"));

        assertCode("CONVERSATION_LIMIT_REACHED", () -> service.createConversation(
                "user", new CreateChatConversationRequest("vi", null, null)));
    }

    @Test
    void sendTrimsContentAndUsesConfiguredLimits() throws Exception {
        AIChatConversation conversation = conversation();
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation));
        when(dao.acceptMessage("user", "conversation", "Giải thích câu này", "key", NOW, 30, 5))
                .thenReturn(accepted(true));

        AIChatDao.AcceptedChatMessage response = service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("  Giải thích câu này  ", "key"));

        assertTrue(response.newlyAccepted());
        verify(dao).acceptMessage("user", "conversation", "Giải thích câu này", "key", NOW, 30, 5);
    }

    @Test
    void sendRejectsBlankOversizedAndMalformedIdempotencyBeforeDependencies() {
        assertCode("CHAT_MESSAGE_INVALID", () -> service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("   ", "key")));
        assertCode("CHAT_MESSAGE_INVALID", () -> service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("a".repeat(1_001), "key")));
        assertCode("CHAT_MESSAGE_INVALID", () -> service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("hello", " ")));
        verifyNoInteractions(subscriptions, contexts, dao);
    }

    @Test
    void sendRevalidatesStoredAttemptContextBeforeAcceptance() throws Exception {
        AIChatConversation conversation = conversation();
        conversation.setContextAttemptId("attempt");
        conversation.setContextQuestionNumber(101);
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation));
        when(contexts.resolve("user", "attempt", 101)).thenReturn(context());
        when(dao.acceptMessage(any(), any(), any(), any(), any(Long.class), any(Integer.class), any(Integer.class)))
                .thenReturn(accepted(true));

        service.sendMessage("user", "conversation", new SendChatMessageRequest("hello", "key"));

        verify(contexts).resolve("user", "attempt", 101);
    }

    @Test
    void foreignConversationIsGenericNotFoundAndNeverAccepts() throws Exception {
        when(dao.findConversation("user", "foreign")).thenReturn(Optional.empty());

        assertCode("NOT_FOUND", () -> service.sendMessage(
                "user", "foreign", new SendChatMessageRequest("hello", "key")));
        verify(dao, never()).acceptMessage(any(), any(), any(), any(), any(Long.class), any(Integer.class), any(Integer.class));
    }

    @Test
    void duplicateAcceptanceIsReturnedWithoutCreatingAnotherApplicationOperation() throws Exception {
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.acceptMessage("user", "conversation", "hello", "key", NOW, 30, 5))
                .thenReturn(accepted(false));

        AIChatDao.AcceptedChatMessage response = service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("hello", "key"));

        assertFalse(response.newlyAccepted());
        verify(dao).acceptMessage("user", "conversation", "hello", "key", NOW, 30, 5);
        verifyNoInteractions(publisher);
    }

    @Test
    void newlyAcceptedMessagePublishesIdentifiersBoundedHistoryAndSanitizedContext() throws Exception {
        AIChatConversation conversation = conversation();
        conversation.setLocale("en");
        conversation.setContextAttemptId("attempt");
        conversation.setContextQuestionNumber(101);
        AIChatQuestionContext context = context();
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation));
        when(contexts.resolve("user", "attempt", 101)).thenReturn(context);
        when(dao.acceptMessage("user", "conversation", "hello", "key", NOW, 30, 5))
                .thenReturn(accepted(true));
        when(dao.listMessages("user", "conversation", 100)).thenReturn(history(15));

        service.sendMessage("user", "conversation", new SendChatMessageRequest("hello", "key"));

        var captor = org.mockito.ArgumentCaptor.forClass(AIChatRequest.class);
        verify(publisher).publish(captor.capture());
        AIChatRequest request = captor.getValue();
        assertEquals("user", request.userId());
        assertEquals("conversation", request.conversationId());
        assertEquals("job", request.jobId());
        assertEquals("user-message", request.userMessageId());
        assertEquals("assistant-message", request.assistantMessageId());
        assertEquals("en", request.locale());
        assertEquals("hello", request.currentMessage());
        assertEquals(context, request.questionContext());
        assertEquals(12, request.history().size());
        assertEquals("history-3", request.history().getFirst().content());
        assertEquals("history-14", request.history().getLast().content());
    }

    @Test
    void publishFailureMarksPendingMessageFailedAndReturnsStableUnavailableCode() throws Exception {
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.acceptMessage("user", "conversation", "hello", "key", NOW, 30, 5))
                .thenReturn(accepted(true));
        doThrow(new IllegalStateException("broker down")).when(publisher).publish(any());

        assertCode("AI_UNAVAILABLE", () -> service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("hello", "key")));

        verify(dao).finalizeMessage("user", "conversation", "job", "assistant-message",
                AIChatJob.Status.FAILED, null, "AI_UNAVAILABLE", NOW);
    }

    @Test
    void historyFailureAfterAdmissionMarksPendingMessageFailedWithoutPublishing() throws Exception {
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.acceptMessage("user", "conversation", "hello", "key", NOW, 30, 5))
                .thenReturn(accepted(true));
        when(dao.listMessages("user", "conversation", 100))
                .thenThrow(new IllegalStateException("Firestore read failed"));

        assertCode("AI_UNAVAILABLE", () -> service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("hello", "key")));

        verify(dao).finalizeMessage("user", "conversation", "job", "assistant-message",
                AIChatJob.Status.FAILED, null, "AI_UNAVAILABLE", NOW);
        verifyNoInteractions(publisher);
    }

    @Test
    void retryRequiresEntitlementAndOwnershipBeforeDao() throws Exception {
        doThrow(code("PRO_REQUIRED")).when(subscriptions).requireEntitlement("user", Entitlement.AI_CHAT);

        assertCode("PRO_REQUIRED", () -> service.retryMessage("user", "conversation", "assistant-message"));
        verify(dao, never()).retryFailedMessage(any(), any(), any(), any(Long.class), any(Integer.class));

        doNothing().when(subscriptions).requireEntitlement("user", Entitlement.AI_CHAT);
        when(dao.findConversation("user", "missing")).thenReturn(Optional.empty());
        assertCode("NOT_FOUND", () -> service.retryMessage("user", "missing", "assistant-message"));
        verify(dao, never()).retryFailedMessage(any(), any(), any(), any(Long.class), any(Integer.class));
    }

    @Test
    void retryReusesMessagePairAndPublishesWithoutChargingQuota() throws Exception {
        AIChatMessage failedAssistant = assistant();
        failedAssistant.setStatus(AIChatMessage.Status.FAILED);
        failedAssistant.setErrorCode("AI_UNAVAILABLE");
        AIChatJob retryJob = job();
        retryJob.setId("retry-job");
        AIChatDao.AcceptedChatMessage retried = new AIChatDao.AcceptedChatMessage(
                conversation(), message(), failedAssistant, retryJob,
                new AIChatDao.QuotaSummary(30, 29, NOW + 1_000), true);
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.retryFailedMessage("user", "conversation", "assistant-message", NOW, 30))
                .thenReturn(retried);
        when(dao.listMessages("user", "conversation", 100)).thenReturn(List.of(message(), failedAssistant));

        AIChatDao.AcceptedChatMessage response = service.retryMessage("user", "conversation", "assistant-message");

        assertTrue(response.newlyAccepted());
        assertEquals("retry-job", response.job().getId());
        assertEquals("user-message", response.userMessage().getId());
        assertEquals("assistant-message", response.assistantMessage().getId());
        var captor = org.mockito.ArgumentCaptor.forClass(AIChatRequest.class);
        verify(publisher).publish(captor.capture());
        AIChatRequest request = captor.getValue();
        assertEquals("retry-job", request.jobId());
        assertEquals("user-message", request.userMessageId());
        assertEquals("assistant-message", request.assistantMessageId());
        assertEquals("hello", request.currentMessage());
    }

    @Test
    void retryRepublishesInflightJobInsteadOfCreatingAnother() throws Exception {
        AIChatJob inflight = job();
        AIChatDao.AcceptedChatMessage retried = new AIChatDao.AcceptedChatMessage(
                conversation(), message(), assistant(), inflight,
                new AIChatDao.QuotaSummary(30, 29, NOW + 1_000), false);
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.retryFailedMessage("user", "conversation", "assistant-message", NOW, 30))
                .thenReturn(retried);

        AIChatDao.AcceptedChatMessage response = service.retryMessage("user", "conversation", "assistant-message");

        assertFalse(response.newlyAccepted());
        verify(publisher).publish(any(AIChatRequest.class));
    }

    @Test
    void retryPublishFailureMarksMessageFailedWithStableCode() throws Exception {
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.retryFailedMessage("user", "conversation", "assistant-message", NOW, 30))
                .thenReturn(accepted(true));
        doThrow(new IllegalStateException("broker down")).when(publisher).publish(any());

        assertCode("AI_UNAVAILABLE", () -> service.retryMessage("user", "conversation", "assistant-message"));

        verify(dao).finalizeMessage("user", "conversation", "job", "assistant-message",
                AIChatJob.Status.FAILED, null, "AI_UNAVAILABLE", NOW);
    }

    @Test
    void retryRejectsBlankAssistantMessageIdBeforeDependencies() throws Exception {
        assertCode("NOT_FOUND", () -> service.retryMessage("user", "conversation", "  "));
        verifyNoInteractions(subscriptions);
        verify(dao, never()).retryFailedMessage(any(), any(), any(), any(Long.class), any(Integer.class));
    }

    @Test
    void readsRemainAvailableWithoutEntitlementButMutationsDoNot() throws Exception {
        when(dao.listConversations("user", 100)).thenReturn(List.of(conversation()));
        when(dao.findConversation("user", "conversation")).thenReturn(Optional.of(conversation()));
        when(dao.listMessages("user", "conversation", 100)).thenReturn(List.of(message()));
        when(dao.findJob("user", "job")).thenReturn(Optional.of(job()));

        assertEquals(1, service.listConversations("user").size());
        assertEquals(1, service.getConversation("user", "conversation").messages().size());
        assertEquals("job", service.getJob("user", "job").getId());
        verifyNoInteractions(subscriptions);

        doThrow(code("PRO_REQUIRED")).when(subscriptions).requireEntitlement("user", Entitlement.AI_CHAT);
        assertCode("PRO_REQUIRED", () -> service.deleteConversation("user", "conversation"));
        assertCode("PRO_REQUIRED", () -> service.renameConversation(
                "user", "conversation", new RenameChatConversationRequest("Tên mới")));
        verify(dao, never()).softDeleteConversation(any(), any(), any(Long.class));
        verify(dao, never()).renameConversation(any(), any(), any(), any(Long.class));
    }

    @Test
    void renameNormalizesTitleAndUsesTrustedTimestamp() throws Exception {
        when(dao.renameConversation("user", "conversation", "Mẹo Part 5", NOW))
                .thenAnswer(call -> {
                    AIChatConversation value = conversation();
                    value.setTitle(call.getArgument(2));
                    return value;
                });

        AIChatConversation renamed = service.renameConversation(
                "user", "conversation", new RenameChatConversationRequest("  Mẹo\u00A0  Part 5  "));

        assertEquals("Mẹo Part 5", renamed.getTitle());
        verify(subscriptions).requireEntitlement("user", Entitlement.AI_CHAT);
        verify(dao).renameConversation("user", "conversation", "Mẹo Part 5", NOW);
    }

    @Test
    void renameRejectsBlankAndOversizedTitlesBeforeDependencies() {
        assertCode("CHAT_TITLE_INVALID", () -> service.renameConversation(
                "user", "conversation", new RenameChatConversationRequest("   ")));
        assertCode("CHAT_TITLE_INVALID", () -> service.renameConversation(
                "user", "conversation", new RenameChatConversationRequest("😀".repeat(61))));
        verifyNoInteractions(subscriptions, dao);
    }

    @Test
    void missingConversationAndJobUseTheSameGenericNotFoundCode() throws Exception {
        when(dao.findConversation("user", "missing")).thenReturn(Optional.empty());
        when(dao.findJob("user", "missing")).thenReturn(Optional.empty());

        assertCode("NOT_FOUND", () -> service.getConversation("user", "missing"));
        assertCode("NOT_FOUND", () -> service.getJob("user", "missing"));
    }

    private AIChatDao.AcceptedChatMessage accepted(boolean newlyAccepted) {
        return new AIChatDao.AcceptedChatMessage(conversation(), message(), assistant(), job(),
                new AIChatDao.QuotaSummary(30, 29, NOW + 1_000), newlyAccepted);
    }

    private AIChatConversation conversation() {
        AIChatConversation value = new AIChatConversation();
        value.setId("conversation");
        value.setUserId("user");
        value.setLocale("vi");
        value.setStatus(AIChatConversation.Status.ACTIVE);
        value.setCreatedAt(NOW);
        value.setUpdatedAt(NOW);
        value.setLastMessageAt(NOW);
        return value;
    }

    private AIChatMessage message() {
        AIChatMessage value = new AIChatMessage();
        value.setId("user-message");
        value.setRole(AIChatMessage.Role.USER);
        value.setStatus(AIChatMessage.Status.SUCCEEDED);
        value.setContent("hello");
        value.setCreatedAt(NOW);
        return value;
    }

    private AIChatMessage assistant() {
        AIChatMessage value = new AIChatMessage();
        value.setId("assistant-message");
        value.setRole(AIChatMessage.Role.ASSISTANT);
        value.setStatus(AIChatMessage.Status.PENDING);
        value.setCreatedAt(NOW);
        return value;
    }

    private AIChatJob job() {
        AIChatJob value = new AIChatJob();
        value.setId("job");
        value.setUserId("user");
        value.setConversationId("conversation");
        value.setStatus(AIChatJob.Status.PENDING);
        value.setCreatedAt(NOW);
        return value;
    }

    private AIChatQuestionContext context() {
        return new AIChatQuestionContext(5, 101, "Question", List.of(), "A", "B",
                "Because", null, null, null, null);
    }

    private List<AIChatMessage> history(int count) {
        java.util.ArrayList<AIChatMessage> values = new java.util.ArrayList<>();
        for (int index = 0; index < count; index++) {
            AIChatMessage value = message();
            value.setId("history-id-" + index);
            value.setContent("history-" + index);
            value.setRole(index % 2 == 0 ? AIChatMessage.Role.USER : AIChatMessage.Role.ASSISTANT);
            value.setCreatedAt(NOW - count + index);
            values.add(value);
        }
        return values;
    }

    private ApiCodeException code(String code) {
        return new ApiCodeException(org.springframework.http.HttpStatus.CONFLICT, code, code);
    }

    private void assertCode(String expected, Throwing operation) {
        ApiCodeException error = assertThrows(ApiCodeException.class, operation::run);
        assertEquals(expected, error.getCode());
    }

    @FunctionalInterface
    private interface Throwing {
        void run() throws Exception;
    }
}
