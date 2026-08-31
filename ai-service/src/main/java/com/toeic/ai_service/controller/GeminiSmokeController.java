package com.toeic.ai_service.controller;


import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/ai")
public class GeminiSmokeController {
    private final GoogleGenAiChatModel chatModel;

    public GeminiSmokeController(GoogleGenAiChatModel chatModel) {
        this.chatModel = chatModel;
    }

    @PostMapping("/test")
    public PromptResponse test(@Valid @RequestBody PromptRequest request) {
        String answer = chatModel.call(request.prompt());
        return new PromptResponse(answer);
    }

    public record PromptRequest(
            @NotBlank String prompt
    ) {
    }

    public record PromptResponse(
            String answer
    ) {
    }
}
