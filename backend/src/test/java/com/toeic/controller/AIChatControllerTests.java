package com.toeic.controller;

import com.toeic.dao.AIChatDao;
import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
import com.toeic.model.AIChatMessage;
import com.toeic.model.enums.UserRole;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.AIChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.bind.support.WebDataBinderFactory;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AIChatControllerTests {
    private static final long NOW = 1_800_000_000_000L;
    private AIChatService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        service = mock(AIChatService.class);
        ToeicUserPrincipal principal = new ToeicUserPrincipal(
                "user", "user@example.com", "User", null, UserRole.USER, 1L, 1L);
        mockMvc = MockMvcBuilders.standaloneSetup(new AIChatController(service))
                .setControllerAdvice(new ApiExceptionHandler())
                .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                    @Override
                    public boolean supportsParameter(MethodParameter parameter) {
                        return parameter.getParameterType() == ToeicUserPrincipal.class;
                    }

                    @Override
                    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                                  NativeWebRequest request, WebDataBinderFactory factory) {
                        return principal;
                    }
                }).build();
    }

    @Test
    void createConversationReturnsCreatedResource() throws Exception {
        when(service.createConversation(eq("user"), any())).thenReturn(conversation("conversation"));

        mockMvc.perform(post("/api/ai/chat/conversations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"locale\":\"vi\",\"attemptId\":\"attempt\",\"questionNumber\":101}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("conversation"))
                .andExpect(jsonPath("$.locale").value("vi"))
                .andExpect(jsonPath("$.userId").doesNotExist());
    }

    @Test
    void listAndOpenConversationReturnPersistedHistory() throws Exception {
        when(service.listConversations("user")).thenReturn(List.of(conversation("conversation")));
        when(service.getConversation("user", "conversation"))
                .thenReturn(new AIChatService.ConversationDetail(
                        conversation("conversation"), List.of(message("message", AIChatMessage.Role.USER))));

        mockMvc.perform(get("/api/ai/chat/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("conversation"));
        mockMvc.perform(get("/api/ai/chat/conversations/{conversationId}", "conversation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversation.id").value("conversation"))
                .andExpect(jsonPath("$.messages[0].id").value("message"))
                .andExpect(jsonPath("$.conversation.userId").doesNotExist());
    }

    @Test
    void sendReturnsAcceptedMessagesJobAndQuota() throws Exception {
        when(service.sendMessage(eq("user"), eq("conversation"), any())).thenReturn(accepted());

        mockMvc.perform(post("/api/ai/chat/conversations/{conversationId}/messages", "conversation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Explain this\",\"idempotencyKey\":\"key\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.userMessage.id").value("user-message"))
                .andExpect(jsonPath("$.assistantMessage.status").value("PENDING"))
                .andExpect(jsonPath("$.job.id").value("job"))
                .andExpect(jsonPath("$.job.idempotencyKey").doesNotExist())
                .andExpect(jsonPath("$.job.userId").doesNotExist())
                .andExpect(jsonPath("$.quotaSummary.remainingDaily").value(29))
                .andExpect(jsonPath("$.newlyAccepted").value(true));
    }

    @Test
    void deleteConversationReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/ai/chat/conversations/{conversationId}", "conversation"))
                .andExpect(status().isNoContent());

        verify(service).deleteConversation("user", "conversation");
    }

    @Test
    void jobPollingReturnsOwnedJob() throws Exception {
        when(service.getJob("user", "job")).thenReturn(job());

        mockMvc.perform(get("/api/ai/chat/jobs/{jobId}", "job"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("job"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.idempotencyKey").doesNotExist())
                .andExpect(jsonPath("$.userId").doesNotExist());
    }

    @Test
    void pathVariablesAreDecodedBeforeOwnershipLookup() throws Exception {
        when(service.getConversation("user", "conversation id"))
                .thenReturn(new AIChatService.ConversationDetail(conversation("conversation id"), List.of()));

        mockMvc.perform(get("/api/ai/chat/conversations/{conversationId}", "conversation id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversation.id").value("conversation id"));
        verify(service).getConversation("user", "conversation id");
    }

    @Test
    void serviceOwnershipAndEntitlementErrorsKeepStableCodes() throws Exception {
        when(service.getJob("user", "foreign")).thenThrow(
                new ApiCodeException(org.springframework.http.HttpStatus.NOT_FOUND, "NOT_FOUND", "missing"));
        when(service.createConversation(eq("user"), any())).thenThrow(
                new ApiCodeException(org.springframework.http.HttpStatus.FORBIDDEN, "PRO_REQUIRED", "pro"));

        mockMvc.perform(get("/api/ai/chat/jobs/foreign"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(post("/api/ai/chat/conversations")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"locale\":\"vi\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PRO_REQUIRED"));
    }

    @Test
    void malformedJsonUsesStandardRequestBodyError() throws Exception {
        mockMvc.perform(post("/api/ai/chat/conversations")
                        .contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST_BODY"));
    }

    private AIChatDao.AcceptedChatMessage accepted() {
        AIChatMessage userMessage = message("user-message", AIChatMessage.Role.USER);
        AIChatMessage assistant = message("assistant-message", AIChatMessage.Role.ASSISTANT);
        assistant.setStatus(AIChatMessage.Status.PENDING);
        assistant.setContent(null);
        return new AIChatDao.AcceptedChatMessage(conversation("conversation"), userMessage, assistant, job(),
                new AIChatDao.QuotaSummary(30, 29, NOW + 1_000), true);
    }

    private AIChatConversation conversation(String id) {
        AIChatConversation value = new AIChatConversation();
        value.setId(id);
        value.setUserId("user");
        value.setTitle("Hội thoại TOEIC mới");
        value.setLocale("vi");
        value.setStatus(AIChatConversation.Status.ACTIVE);
        value.setCreatedAt(NOW);
        value.setUpdatedAt(NOW);
        value.setLastMessageAt(NOW);
        return value;
    }

    private AIChatMessage message(String id, AIChatMessage.Role role) {
        AIChatMessage value = new AIChatMessage();
        value.setId(id);
        value.setRole(role);
        value.setContent("hello");
        value.setStatus(AIChatMessage.Status.SUCCEEDED);
        value.setCreatedAt(NOW);
        return value;
    }

    private AIChatJob job() {
        AIChatJob value = new AIChatJob();
        value.setId("job");
        value.setUserId("user");
        value.setConversationId("conversation");
        value.setUserMessageId("user-message");
        value.setAssistantMessageId("assistant-message");
        value.setStatus(AIChatJob.Status.PENDING);
        value.setCreatedAt(NOW);
        value.setUpdatedAt(NOW);
        return value;
    }
}
