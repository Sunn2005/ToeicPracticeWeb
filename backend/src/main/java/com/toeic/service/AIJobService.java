package com.toeic.service;

import com.toeic.dao.AIJobDao;
import com.toeic.dto.ai.AIJobRequest;
import com.toeic.dto.ai.AIJobResult;
import com.toeic.model.AIJob;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AIJobService {

    private final AIJobDao aiJobDao;
    private final AIRequestPublisher publisher;

    public AIJobService(
            AIJobDao aiJobDao,
            AIRequestPublisher publisher
    ) {
        this.aiJobDao = aiJobDao;
        this.publisher = publisher;
    }

    public Map<String, Object> createExplanationJob(
            String userId,
            AIJobRequest.Payload payload
    ) throws Exception {
        if (payload == null
                || payload.question() == null
                || payload.question().isBlank()
                || payload.options() == null
                || payload.options().isEmpty()
                || payload.correctAnswer() == null
                || payload.correctAnswer().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu dữ liệu câu hỏi hoặc đáp án"
            );
        }

        String jobId = UUID.randomUUID().toString();
        long now = System.currentTimeMillis();

        AIJob job = new AIJob(
                jobId,
                userId,
                "EXPLAIN_ANSWER",
                "PENDING",
                now,
                now,
                null,
                null,
                null
        );

        // Phải lưu PENDING trước khi publish để tránh AI trả kết quả quá nhanh.
        aiJobDao.save(job);

        AIJobRequest message = new AIJobRequest(
                1,
                jobId,
                "EXPLAIN_ANSWER",
                Instant.now().toString(),
                payload
        );

        try {
            publisher.publish(message);
        } catch (RuntimeException exception) {
            aiJobDao.markFailed(
                    jobId,
                    "Không thể gửi yêu cầu tới AI service",
                    System.currentTimeMillis()
            );
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI service tạm thời không khả dụng",
                    exception
            );
        }

        return toResponse(job);
    }

    public void handleResult(AIJobResult message) throws Exception {
        if (message == null
                || message.jobId() == null
                || message.jobId().isBlank()) {
            throw new IllegalArgumentException("AI result thiếu jobId");
        }

        long completedAt = System.currentTimeMillis();
        boolean updated;

        if ("SUCCEEDED".equals(message.status())
                && message.result() != null) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("explanation", message.result().explanation());
            result.put("grammarPoint", message.result().grammarPoint());
            result.put("correctAnswer", message.result().correctAnswer());

            updated = aiJobDao.markSucceeded(
                    message.jobId(),
                    result,
                    completedAt
            );
        } else {
            updated = aiJobDao.markFailed(
                    message.jobId(),
                    message.error(),
                    completedAt
            );
        }

        // Message test cũ có thể không có document tương ứng.
        // Không throw để tránh message bị requeue vô hạn.
        if (!updated) {
            System.err.println(
                    "Không tìm thấy AI job: " + message.jobId()
            );
        }
    }

    public Map<String, Object> getOwnedJob(
            String userId,
            String jobId
    ) throws Exception {
        AIJob job = aiJobDao.findById(jobId)
                .filter(found -> userId.equals(found.getUserId()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy AI job"
                ));

        return toResponse(job);
    }

    private Map<String, Object> toResponse(AIJob job) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jobId", job.getId());
        response.put("taskType", job.getTaskType());
        response.put("status", job.getStatus());
        response.put("createdAt", job.getCreatedAt());
        response.put("updatedAt", job.getUpdatedAt());
        response.put("completedAt", job.getCompletedAt());
        response.put("result", job.getResult());
        response.put("error", job.getError());
        return response;
    }
}