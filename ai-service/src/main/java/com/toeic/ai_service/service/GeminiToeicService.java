package com.toeic.ai_service.service;

import com.toeic.ai_service.model.AIJobRequest;
import com.toeic.ai_service.model.ToeicExplanation;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public class GeminiToeicService {

    private final ChatClient chatClient;

    public GeminiToeicService(ChatClient.Builder builder) {
        this.chatClient = builder.build();
    }

    public ToeicExplanation explain(AIJobRequest.Payload payload) {
        ToeicExplanation explanation = chatClient.prompt()
                .system("""
                        Bạn là giáo viên TOEIC chuyên nghiệp.

                        Yêu cầu:
                        - Giải thích bằng tiếng Việt.
                        - Giải thích ngắn gọn, dễ hiểu.
                        - Chỉ sử dụng đáp án đúng đã được cung cấp.
                        - Không tự thay đổi đáp án.
                        - Nêu điểm ngữ pháp hoặc từ vựng quan trọng.
                        """)
                .user(user -> user
                        .text("""
                                Câu hỏi: {question}
                                Các lựa chọn: {options}
                                Đáp án đúng: {correctAnswer}
                                Đáp án người học: {userAnswer}
                                Ngôn ngữ giải thích: {locale}
                                """)
                        .param("question", payload.question())
                        .param("options", payload.options())
                        .param("correctAnswer", payload.correctAnswer())
                        .param("userAnswer", payload.userAnswer())
                        .param("locale", payload.locale()))
                .call()
                .entity(
                        ToeicExplanation.class,
                        spec -> spec.useProviderStructuredOutput()
                );

        return Objects.requireNonNull(
                explanation,
                "Gemini trả về kết quả rỗng"
        );
    }
}