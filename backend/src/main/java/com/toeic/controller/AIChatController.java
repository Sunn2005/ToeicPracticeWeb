package com.toeic.controller;

import com.toeic.dao.AIChatDao;
import com.toeic.dto.CreateChatConversationRequest;
import com.toeic.dto.SendChatMessageRequest;
import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
import com.toeic.model.AIChatMessage;
import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.AIChatService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/ai/chat")
@PreAuthorize("isAuthenticated()")
public class AIChatController {
    private final AIChatService chatService;

    public AIChatController(AIChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping("/conversations")
    public ResponseEntity<ConversationResponse> createConversation(
            @RequestBody CreateChatConversationRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ConversationResponse.from(chatService.createConversation(principal.uid(), request)));
    }

    @GetMapping("/conversations")
    public List<ConversationResponse> listConversations(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return chatService.listConversations(principal.uid()).stream().map(ConversationResponse::from).toList();
    }

    @GetMapping("/conversations/{conversationId}")
    public ConversationDetailResponse getConversation(
            @PathVariable String conversationId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        AIChatService.ConversationDetail detail = chatService.getConversation(principal.uid(), conversationId);
        return new ConversationDetailResponse(
                ConversationResponse.from(detail.conversation()),
                detail.messages().stream().map(MessageResponse::from).toList());
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<AcceptedMessageResponse> sendMessage(
            @PathVariable String conversationId,
            @RequestBody SendChatMessageRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return ResponseEntity.accepted().body(AcceptedMessageResponse.from(
                chatService.sendMessage(principal.uid(), conversationId, request)));
    }

    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<Void> deleteConversation(
            @PathVariable String conversationId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        chatService.deleteConversation(principal.uid(), conversationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/jobs/{jobId}")
    public JobResponse getJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return JobResponse.from(chatService.getJob(principal.uid(), jobId));
    }

    public record ConversationResponse(
            String id, String title, String locale, String contextAttemptId, Integer contextQuestionNumber,
            AIChatConversation.Status status, Long createdAt, Long updatedAt, Long lastMessageAt
    ) {
        static ConversationResponse from(AIChatConversation value) {
            return new ConversationResponse(value.getId(), value.getTitle(), value.getLocale(),
                    value.getContextAttemptId(), value.getContextQuestionNumber(), value.getStatus(),
                    value.getCreatedAt(), value.getUpdatedAt(), value.getLastMessageAt());
        }
    }

    public record MessageResponse(
            String id, AIChatMessage.Role role, String content, AIChatMessage.Status status,
            String jobId, String errorCode, Long createdAt, Long completedAt
    ) {
        static MessageResponse from(AIChatMessage value) {
            return new MessageResponse(value.getId(), value.getRole(), value.getContent(), value.getStatus(),
                    value.getJobId(), value.getErrorCode(), value.getCreatedAt(), value.getCompletedAt());
        }
    }

    public record JobResponse(
            String id, String conversationId, String userMessageId, String assistantMessageId,
            AIChatJob.Status status, String errorCode, Long createdAt, Long updatedAt, Long completedAt
    ) {
        static JobResponse from(AIChatJob value) {
            return new JobResponse(value.getId(), value.getConversationId(), value.getUserMessageId(),
                    value.getAssistantMessageId(), value.getStatus(), value.getErrorCode(),
                    value.getCreatedAt(), value.getUpdatedAt(), value.getCompletedAt());
        }
    }

    public record ConversationDetailResponse(
            ConversationResponse conversation, List<MessageResponse> messages
    ) {
        public ConversationDetailResponse {
            messages = List.copyOf(messages);
        }
    }

    public record AcceptedMessageResponse(
            MessageResponse userMessage,
            MessageResponse assistantMessage,
            JobResponse job,
            AIChatDao.QuotaSummary quotaSummary,
            boolean newlyAccepted
    ) {
        static AcceptedMessageResponse from(AIChatDao.AcceptedChatMessage value) {
            return new AcceptedMessageResponse(MessageResponse.from(value.userMessage()),
                    MessageResponse.from(value.assistantMessage()), JobResponse.from(value.job()),
                    value.quotaSummary(), value.newlyAccepted());
        }
    }
}
