package com.toeic.service;

import com.toeic.dao.AIAnalysisDao;
import com.toeic.dao.AttemptDao;
import com.toeic.dto.ai.AIReviewCompleted;
import com.toeic.dto.ai.AIReviewFailed;
import com.toeic.dto.ai.AIReviewRequest;
import com.toeic.model.Attempt;
import com.toeic.model.enums.AIAnalysisStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
public class AIReviewService {

    private static final String NOT_REQUESTED = AIAnalysisStatus.NOT_REQUESTED.name();
    private static final String PENDING = AIAnalysisStatus.PENDING.name();
    private static final String PROCESSING = AIAnalysisStatus.PROCESSING.name();
    private static final String COMPLETED = AIAnalysisStatus.COMPLETED.name();
    private static final String FAILED = AIAnalysisStatus.FAILED.name();
    private static final Set<String> ACTIVE_STATUSES = Set.of(PENDING, PROCESSING);

    private final AttemptDao attemptDao;
    private final AIAnalysisDao analysisDao;
    private final AIReviewRequestPublisher publisher;

    public AIReviewService(
            AttemptDao attemptDao,
            AIAnalysisDao analysisDao,
            AIReviewRequestPublisher publisher
    ) {
        this.attemptDao = attemptDao;
        this.analysisDao = analysisDao;
        this.publisher = publisher;
    }

    public Map<String, Object> requestAnalysis(String userId, String attemptId) throws Exception {
        return requestAnalysis(userId, attemptId, false);
    }

    public Map<String, Object> requestAnalysis(
            String userId,
            String attemptId,
            boolean refresh
    ) throws Exception {
        Attempt attempt = ownedAttempt(userId, attemptId);
        requireEligible(attempt);

        String currentStatus = status(attempt);
        if (ACTIVE_STATUSES.contains(currentStatus) || (COMPLETED.equals(currentStatus) && !refresh)) {
            return statusResponse(attempt, currentStatus, currentStatus.equals(COMPLETED)
                    ? "Bài làm đã được phân tích."
                    : "Yêu cầu phân tích đang được xử lý.");
        }

        long now = System.currentTimeMillis();
        attempt.setAiAnalysisStatus(PENDING);
        attempt.setAiAnalysisId(null);
        attempt.setAiAnalysisRequestedAt(now);
        attempt.setUpdatedAt(now);
        attemptDao.save(attempt);

        try {
            publisher.publish(new AIReviewRequest(attemptId, userId, refresh));
        } catch (RuntimeException exception) {
            attempt.setAiAnalysisStatus(FAILED);
            attempt.setUpdatedAt(System.currentTimeMillis());
            attemptDao.save(attempt);
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Không thể gửi yêu cầu phân tích tới AI Service",
                    exception
            );
        }
        return statusResponse(attempt, PENDING, "Yêu cầu phân tích đã được tiếp nhận.");
    }

    public Map<String, Object> getAnalysis(String userId, String attemptId) throws Exception {
        Attempt attempt = ownedAttempt(userId, attemptId);
        String currentStatus = status(attempt);
        Map<String, Object> response = statusResponse(attempt, currentStatus, null);
        response.put("result", null);
        if (COMPLETED.equals(currentStatus)) {
            Map<String, Object> analysis = analysisDao.findByAttemptId(attemptId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Trạng thái đã hoàn thành nhưng chưa tìm thấy kết quả phân tích"
                    ));
            if (!userId.equals(String.valueOf(analysis.get("userId")))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem phân tích này");
            }
            response.put("result", analysis.get("result"));
        }
        return response;
    }

    public void handleCompleted(AIReviewCompleted message) throws Exception {
        requireCompletionMessage(message);
        Attempt attempt = attemptDao.findById(message.attemptId()).orElse(null);
        if (attempt == null || !message.userId().equals(attempt.getUserId())) {
            return;
        }
        if (COMPLETED.equals(status(attempt))
                && message.analysisId().equals(attempt.getAiAnalysisId())) {
            return;
        }
        if (analysisDao.findByAttemptId(message.attemptId()).isEmpty()) {
            throw new IllegalStateException("Chưa có kết quả Firestore cho attempt " + message.attemptId());
        }
        attempt.setAiAnalysisStatus(COMPLETED);
        attempt.setAiAnalysisId(message.analysisId());
        attempt.setUpdatedAt(System.currentTimeMillis());
        attemptDao.save(attempt);
    }

    public void handleFailed(AIReviewFailed message) throws Exception {
        if (message == null || blank(message.attemptId()) || blank(message.userId())) {
            throw new IllegalArgumentException("AI review failed message không hợp lệ");
        }
        Attempt attempt = attemptDao.findById(message.attemptId()).orElse(null);
        if (attempt == null || !message.userId().equals(attempt.getUserId())
                || COMPLETED.equals(status(attempt))) {
            return;
        }
        attempt.setAiAnalysisStatus(FAILED);
        attempt.setUpdatedAt(System.currentTimeMillis());
        attemptDao.save(attempt);
    }

    private Attempt ownedAttempt(String userId, String attemptId) throws Exception {
        Attempt attempt = attemptDao.findById(attemptId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài làm")
        );
        if (!userId.equals(attempt.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        return attempt;
    }

    private void requireEligible(Attempt attempt) {
        if (!"FULL_TEST".equals(attempt.getType()) || !"FULL".equals(attempt.getMode())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Nhận xét AI chỉ áp dụng cho Full Test"
            );
        }
        if (!"COMPLETED".equals(attempt.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ có thể phân tích bài làm đã hoàn thành"
            );
        }
    }

    private Map<String, Object> statusResponse(Attempt attempt, String currentStatus, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attemptId", attempt.getId());
        response.put("aiAnalysisStatus", currentStatus);
        response.put("status", currentStatus);
        if (message != null) {
            response.put("message", message);
        }
        return response;
    }

    private String status(Attempt attempt) {
        return blank(attempt.getAiAnalysisStatus()) ? NOT_REQUESTED : attempt.getAiAnalysisStatus();
    }

    private void requireCompletionMessage(AIReviewCompleted message) {
        if (message == null || blank(message.attemptId()) || blank(message.userId())
                || blank(message.analysisId()) || !COMPLETED.equals(message.status())) {
            throw new IllegalArgumentException("AI review completed message không hợp lệ");
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
