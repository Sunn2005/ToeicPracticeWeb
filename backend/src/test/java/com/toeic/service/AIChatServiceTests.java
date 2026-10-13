package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.AIChatDao;
import com.toeic.dto.CreateChatConversationRequest;
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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class AIChatServiceTests {
    private static final long NOW = 1_800_000_000_000L;
    private AIChatDao dao;
    private SubscriptionService subscriptions;
    private AttemptService attempts;
    private ChatAttemptContextService contexts;
    private AIChatRequestPublisher publisher;
    private AIChatService service;

    @BeforeEach
    void setUp() {
        dao = mock(AIChatDao.class);
        subscriptions = mock(SubscriptionService.class);
        attempts = mock(AttemptService.class);
        contexts = mock(ChatAttemptContextService.class);
        publisher = mock(AIChatRequestPublisher.class);
        service = new AIChatService(dao, subscriptions, attempts, contexts, publisher,
                Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC), 30, 5, 10, 100, 1_000, 12);
    }

    @Test
    void createRequiresAiChatEntitlementBeforeAttemptOrPersistence() throws Exception {
        doThrow(code("PRO_REQUIRED")).when(subscriptions).requireEntitlement("user", Entitlement.AI_CHAT);

        ApiCodeException error = assertThrows(ApiCodeException.class,
                () -> service.createConversation("user", new CreateChatConversationRequest("vi", null, null)));

        assertEquals("PRO_REQUIRED", error.getCode());
        verifyNoInteractions(attempts, contexts, dao);
    }

    @Test
    void createChecksAttemptSafetyAndResolvesExactlyTheRequestedContext() throws Exception {
        AIChatQuestionContext context = context();
        when(contexts.resolve("user", "attempt", 101)).thenReturn(context);
        when(dao.createConversation(any(), eq(10))).thenAnswer(call -> call.getArgument(0));

        AIChatConversation created = service.createConversation(
                "user", new CreateChatConversationRequest("en", "attempt", 101));

        verify(attempts).requireNoInProgressAttempt("user");
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
        verifyNoInteractions(subscriptions, attempts, contexts, dao);
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
        verify(attempts).requireNoInProgressAttempt("user");
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
        verifyNoInteractions(subscriptions, attempts, contexts, dao);
    }

    @Test
    void sendBlocksInProgressAttemptBeforeConversationOrQuotaReads() throws Exception {
        doThrow(code("CHAT_BLOCKED_DURING_ATTEMPT")).when(attempts).requireNoInProgressAttempt("user");

        assertCode("CHAT_BLOCKED_DURING_ATTEMPT", () -> service.sendMessage(
                "user", "conversation", new SendChatMessageRequest("hello", "key")));

        verify(dao, never()).findConversation(any(), any());
        verify(dao, never()).acceptMessage(any(), any(), any(), any(), any(Long.class), any(Integer.class), any(Integer.class));
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
        verify(dao, never()).softDeleteConversation(any(), any(), any(Long.class));
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
