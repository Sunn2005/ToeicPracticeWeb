package com.toeic.controller;

import com.toeic.dao.AIChatDao;
import com.toeic.dto.CreateChatConversationRequest;
import com.toeic.dto.SendChatMessageRequest;
import com.toeic.model.AIChatConversation;
import com.toeic.model.AIChatJob;
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
    public ResponseEntity<AIChatConversation> createConversation(
            @RequestBody CreateChatConversationRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(chatService.createConversation(principal.uid(), request));
    }

    @GetMapping("/conversations")
    public List<AIChatConversation> listConversations(
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return chatService.listConversations(principal.uid());
    }

    @GetMapping("/conversations/{conversationId}")
    public AIChatService.ConversationDetail getConversation(
            @PathVariable String conversationId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return chatService.getConversation(principal.uid(), conversationId);
    }

    @PostMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<AIChatDao.AcceptedChatMessage> sendMessage(
            @PathVariable String conversationId,
            @RequestBody SendChatMessageRequest request,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return ResponseEntity.accepted().body(chatService.sendMessage(principal.uid(), conversationId, request));
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
    public AIChatJob getJob(
            @PathVariable String jobId,
            @AuthenticationPrincipal ToeicUserPrincipal principal
    ) throws Exception {
        return chatService.getJob(principal.uid(), jobId);
    }
}
