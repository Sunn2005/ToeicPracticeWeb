package com.toeic.service;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.toeic.model.Attempt;
import com.toeic.model.AttemptSection;
import com.toeic.model.AttemptStatus;
import com.toeic.model.TestType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AttemptService {

    public static final String FULL_TEST = TestType.FULL_TEST.name();
    public static final String IN_PROGRESS = AttemptStatus.IN_PROGRESS.name();
    public static final String COMPLETED = AttemptStatus.COMPLETED.name();
    public static final String LISTENING = AttemptSection.LISTENING.name();
    public static final String READING = AttemptSection.READING.name();
    public static final String FINISHED = AttemptSection.FINISHED.name();

    private static final long LISTENING_DURATION_MS = 45L * 60L * 1000L;
    private static final long READING_DURATION_MS = 75L * 60L * 1000L;

    private final Firestore firestore;
    private final TestService testService;

    public AttemptService(Firestore firestore, TestService testService) {
        this.firestore = firestore;
        this.testService = testService;
    }

    public Map<String, Object> createOrResume(String userId, String testId) throws Exception {
        testService.getMetadata(testId);

        Attempt active = findCurrentAttempt(userId, testId);
        if (active != null) {
            active = reconcileTimeout(active);
            if (IN_PROGRESS.equals(active.getStatus())) {
                return toResponse(active, true);
            }
        }

        long now = System.currentTimeMillis();
        DocumentReference document = firestore.collection("attempts").document();

        Attempt attempt = new Attempt();
        attempt.setId(document.getId());
        attempt.setUserId(userId);
        attempt.setTestId(testId);
        attempt.setType(FULL_TEST);
        attempt.setStatus(IN_PROGRESS);
        attempt.setCurrentSection(LISTENING);
        attempt.setCurrentQuestionNumber(1);
        attempt.setStartedAt(now);
        attempt.setUpdatedAt(now);
        attempt.setSectionStartedAt(now);
        attempt.setSectionEndAt(now + LISTENING_DURATION_MS);
        attempt.setListeningStartedAt(now);
        attempt.setListeningEndAt(now + LISTENING_DURATION_MS);
        attempt.setSubmittedAt(null);
        attempt.setScore(null);
        attempt.setResult(null);
        attempt.setAnswers(null);

        document.set(attempt).get();
        return toResponse(attempt, true);
    }

    public Map<String, Object> getCurrent(String userId, String testId) throws Exception {
        Attempt active = findCurrentAttempt(userId, testId);
        if (active == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không có bài đang làm");
        }

        active = reconcileTimeout(active);
        if (!IN_PROGRESS.equals(active.getStatus())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không có bài đang làm");
        }
        return toResponse(active, true);
    }

    public Map<String, Object> getAttempt(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        return toResponse(attempt, true);
    }

    public Map<String, Object> getExam(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (!IN_PROGRESS.equals(attempt.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài thi đã kết thúc");
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attempt", toResponse(attempt, true));
        response.put("test", testService.getExamTest(attempt.getTestId()));
        return response;
    }

    public Map<String, Object> saveAnswer(
            String userId,
            String attemptId,
            Integer questionNumber,
            String selectedAnswer
    ) throws Exception {
        if (questionNumber == null || questionNumber < 1 || questionNumber > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "questionNumber phải từ 1 đến 200");
        }

        String normalizedAnswer = normalizeAnswer(selectedAnswer);
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        requireInProgress(attempt);

        if (LISTENING.equals(attempt.getCurrentSection())) {
            int unitStart = listeningUnitStart(attempt.getCurrentQuestionNumber());
            int unitEnd = listeningUnitEnd(unitStart);
            if (questionNumber < unitStart || questionNumber > unitEnd) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Listening chỉ cho phép lưu câu đang hiển thị; câu trước đã bị khóa"
                );
            }
        } else if (READING.equals(attempt.getCurrentSection())) {
            if (questionNumber < 101) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Không thể sửa đáp án Listening sau khi đã sang Reading"
                );
            }
        } else {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài thi không còn nhận đáp án");
        }

        long now = System.currentTimeMillis();
        Map<String, Object> answerDocument = new LinkedHashMap<>();
        answerDocument.put("questionNumber", questionNumber);
        answerDocument.put("selectedAnswer", normalizedAnswer);
        answerDocument.put("answeredAt", now);

        firestore.collection("attempts")
                .document(attemptId)
                .collection("answers")
                .document(String.valueOf(questionNumber))
                .set(answerDocument)
                .get();

        attempt.setUpdatedAt(now);
        firestore.collection("attempts")
                .document(attemptId)
                .update("updatedAt", now)
                .get();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("questionNumber", questionNumber);
        response.put("selectedAnswer", normalizedAnswer);
        response.put("savedAt", now);
        response.put("attempt", toResponse(attempt, false));
        return response;
    }

    public Map<String, Object> updatePosition(
            String userId,
            String attemptId,
            Integer questionNumber
    ) throws Exception {
        if (questionNumber == null || questionNumber < 101 || questionNumber > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu Reading phải từ 101 đến 200");
        }

        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        requireInProgress(attempt);
        if (!READING.equals(attempt.getCurrentSection())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chưa đến phần Reading");
        }

        attempt.setCurrentQuestionNumber(questionNumber);
        attempt.setUpdatedAt(System.currentTimeMillis());
        saveAttempt(attempt);
        return toResponse(attempt, true);
    }

    public Map<String, Object> nextListening(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        requireInProgress(attempt);

        if (READING.equals(attempt.getCurrentSection())) {
            return toResponse(attempt, true);
        }
        if (!LISTENING.equals(attempt.getCurrentSection())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không ở phần Listening");
        }

        int currentStart = listeningUnitStart(attempt.getCurrentQuestionNumber());
        if (currentStart >= 98) {
            transitionToReading(attempt, System.currentTimeMillis());
        } else {
            int next = currentStart < 31 ? currentStart + 1 : currentStart == 31 ? 32 : currentStart + 3;
            attempt.setCurrentQuestionNumber(next);
            attempt.setUpdatedAt(System.currentTimeMillis());
        }

        saveAttempt(attempt);
        return toResponse(attempt, true);
    }

    public Map<String, Object> finishListening(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        requireInProgress(attempt);

        if (LISTENING.equals(attempt.getCurrentSection())) {
            transitionToReading(attempt, System.currentTimeMillis());
            saveAttempt(attempt);
        }
        return toResponse(attempt, true);
    }

    public Map<String, Object> submit(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (COMPLETED.equals(attempt.getStatus())) {
            return attempt.getResult();
        }
        requireInProgress(attempt);
        if (!READING.equals(attempt.getCurrentSection())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Hãy hoàn thành Listening trước khi nộp Full Test"
            );
        }
        return submitInternal(attempt, false).getResult();
    }

    public Map<String, Object> getResult(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (!COMPLETED.equals(attempt.getStatus()) || attempt.getResult() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài thi chưa được nộp");
        }
        return attempt.getResult();
    }

    public Map<String, Object> getReview(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (!COMPLETED.equals(attempt.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ được xem đáp án sau khi nộp bài");
        }

        Map<Integer, String> answers = loadAnswers(attempt.getId());
        Map<String, Object> reviewTest = testService.addReviewAnswers(
                testService.getReviewTest(attempt.getTestId()),
                answers
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attempt", toResponse(attempt, true));
        response.put("result", attempt.getResult());
        response.put("test", reviewTest);
        return response;
    }

    private Attempt findCurrentAttempt(String userId, String testId) throws Exception {
        List<Attempt> candidates = new ArrayList<>();
        for (QueryDocumentSnapshot snapshot : firestore.collection("attempts")
                .whereEqualTo("userId", userId)
                .get()
                .get()
                .getDocuments()) {
            Attempt attempt = snapshot.toObject(Attempt.class);
            if (attempt.getId() == null) {
                attempt.setId(snapshot.getId());
            }
            if (testId.equals(attempt.getTestId())
                    && FULL_TEST.equals(attempt.getType())
                    && IN_PROGRESS.equals(attempt.getStatus())) {
                candidates.add(attempt);
            }
        }

        return candidates.stream()
                .max(Comparator.comparing(attempt -> attempt.getStartedAt() == null ? 0L : attempt.getStartedAt()))
                .orElse(null);
    }

    private Attempt getOwnedAttempt(String userId, String attemptId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("attempts").document(attemptId).get().get();
        if (!snapshot.exists()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài làm");
        }

        Attempt attempt = snapshot.toObject(Attempt.class);
        if (attempt == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Dữ liệu bài làm không hợp lệ");
        }
        if (attempt.getId() == null) {
            attempt.setId(snapshot.getId());
        }
        if (!userId.equals(attempt.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        if (!FULL_TEST.equals(attempt.getType())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đây không phải Full Test attempt");
        }
        return attempt;
    }

    private Attempt reconcileTimeout(Attempt attempt) throws Exception {
        if (!IN_PROGRESS.equals(attempt.getStatus())) {
            return attempt;
        }

        long now = System.currentTimeMillis();
        if (LISTENING.equals(attempt.getCurrentSection())
                && attempt.getSectionEndAt() != null
                && now >= attempt.getSectionEndAt()) {
            transitionToReading(attempt, attempt.getSectionEndAt());
            saveAttempt(attempt);
        }

        if (READING.equals(attempt.getCurrentSection())
                && attempt.getSectionEndAt() != null
                && now >= attempt.getSectionEndAt()) {
            return submitInternal(attempt, true);
        }
        return attempt;
    }

    private void transitionToReading(Attempt attempt, long readingStart) {
        long now = System.currentTimeMillis();
        attempt.setCurrentSection(READING);
        attempt.setCurrentQuestionNumber(101);
        attempt.setListeningEndAt(readingStart);
        attempt.setReadingStartedAt(readingStart);
        attempt.setReadingEndAt(readingStart + READING_DURATION_MS);
        attempt.setSectionStartedAt(readingStart);
        attempt.setSectionEndAt(readingStart + READING_DURATION_MS);
        attempt.setUpdatedAt(now);
    }

    private Attempt submitInternal(Attempt attempt, boolean autoSubmitted) throws Exception {
        if (COMPLETED.equals(attempt.getStatus())) {
            return attempt;
        }

        Map<Integer, String> answerKey = testService.getAnswerKey(attempt.getTestId());
        if (answerKey.size() != 200) {
            throw new IllegalStateException("Đề thi phải có đúng 200 đáp án để chấm điểm");
        }
        Map<Integer, String> selectedAnswers = loadAnswers(attempt.getId());

        int listeningCorrect = 0;
        int readingCorrect = 0;
        int listeningAnswered = 0;
        int readingAnswered = 0;

        for (int number = 1; number <= 200; number++) {
            String selected = selectedAnswers.get(number);
            if (selected != null) {
                if (number <= 100) {
                    listeningAnswered++;
                } else {
                    readingAnswered++;
                }
            }
            if (selected != null && selected.equalsIgnoreCase(answerKey.get(number))) {
                if (number <= 100) {
                    listeningCorrect++;
                } else {
                    readingCorrect++;
                }
            }
        }

        long submittedAt = System.currentTimeMillis();
        int listeningScore = estimateSectionScore(listeningCorrect);
        int readingScore = estimateSectionScore(readingCorrect);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("attemptId", attempt.getId());
        result.put("testId", attempt.getTestId());
        result.put("listeningCorrect", listeningCorrect);
        result.put("listeningWrong", listeningAnswered - listeningCorrect);
        result.put("listeningUnanswered", 100 - listeningAnswered);
        result.put("readingCorrect", readingCorrect);
        result.put("readingWrong", readingAnswered - readingCorrect);
        result.put("readingUnanswered", 100 - readingAnswered);
        result.put("totalCorrect", listeningCorrect + readingCorrect);
        result.put("totalWrong", listeningAnswered + readingAnswered - listeningCorrect - readingCorrect);
        result.put("totalUnanswered", 200 - listeningAnswered - readingAnswered);
        result.put("totalQuestions", 200);
        result.put("correctCount", listeningCorrect + readingCorrect);
        result.put("incorrectCount", listeningAnswered + readingAnswered - listeningCorrect - readingCorrect);
        result.put("unansweredCount", 200 - listeningAnswered - readingAnswered);
        result.put("listeningScore", listeningScore);
        result.put("readingScore", readingScore);
        result.put("totalScore", listeningScore + readingScore);
        result.put("estimatedTotalScore", listeningScore + readingScore);
        result.put("durationSeconds", Math.max(0, (submittedAt - attempt.getStartedAt()) / 1000));
        result.put("submittedAt", submittedAt);
        result.put("autoSubmitted", autoSubmitted);

        attempt.setStatus(COMPLETED);
        attempt.setCurrentSection(FINISHED);
        attempt.setSubmittedAt(submittedAt);
        attempt.setUpdatedAt(submittedAt);
        attempt.setScore(listeningScore + readingScore);
        attempt.setResult(result);
        saveAttempt(attempt);
        return attempt;
    }

    private int estimateSectionScore(int correct) {
        double rawScore = 5.0 + Math.max(0, Math.min(100, correct)) * 4.9;
        return Math.max(5, Math.min(495, (int) Math.round(rawScore / 5.0) * 5));
    }

    private Map<Integer, String> loadAnswers(String attemptId) throws Exception {
        Map<Integer, String> answers = new LinkedHashMap<>();
        for (QueryDocumentSnapshot snapshot : firestore.collection("attempts")
                .document(attemptId)
                .collection("answers")
                .get()
                .get()
                .getDocuments()) {
            Long questionNumber = snapshot.getLong("questionNumber");
            if (questionNumber == null) {
                continue;
            }
            String selected = snapshot.getString("selectedAnswer");
            answers.put(questionNumber.intValue(), selected);
        }
        return answers;
    }

    private Map<String, Object> toResponse(Attempt attempt, boolean includeAnswers) throws Exception {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", attempt.getId());
        response.put("testId", attempt.getTestId());
        response.put("type", attempt.getType());
        response.put("status", attempt.getStatus());
        response.put("currentSection", attempt.getCurrentSection());
        response.put("currentQuestionNumber", attempt.getCurrentQuestionNumber());
        response.put("startedAt", attempt.getStartedAt());
        response.put("updatedAt", attempt.getUpdatedAt());
        response.put("submittedAt", attempt.getSubmittedAt());
        response.put("sectionStartedAt", attempt.getSectionStartedAt());
        response.put("sectionEndAt", attempt.getSectionEndAt());
        response.put("listeningStartedAt", attempt.getListeningStartedAt());
        response.put("listeningEndAt", attempt.getListeningEndAt());
        response.put("readingStartedAt", attempt.getReadingStartedAt());
        response.put("readingEndAt", attempt.getReadingEndAt());
        response.put("serverTime", System.currentTimeMillis());
        response.put("result", attempt.getResult());

        if (includeAnswers) {
            Map<Integer, String> storedAnswers = loadAnswers(attempt.getId());
            Map<String, String> answers = new LinkedHashMap<>();
            int answeredCount = 0;
            for (Map.Entry<Integer, String> entry : storedAnswers.entrySet()) {
                answers.put(String.valueOf(entry.getKey()), entry.getValue());
                if (entry.getValue() != null) {
                    answeredCount++;
                }
            }
            response.put("answers", answers);
            response.put("answeredCount", answeredCount);
        }
        return response;
    }

    private String normalizeAnswer(String selectedAnswer) {
        if (selectedAnswer == null || selectedAnswer.isBlank()) {
            return null;
        }
        String normalized = selectedAnswer.trim().toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C", "D").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "selectedAnswer chỉ nhận A, B, C, D hoặc null");
        }
        return normalized;
    }

    private int listeningUnitStart(Integer questionNumber) {
        int number = questionNumber == null ? 1 : questionNumber;
        if (number <= 31) {
            return Math.max(1, number);
        }
        return 32 + ((number - 32) / 3) * 3;
    }

    private int listeningUnitEnd(int unitStart) {
        return unitStart <= 31 ? unitStart : Math.min(100, unitStart + 2);
    }

    private void requireInProgress(Attempt attempt) {
        if (!IN_PROGRESS.equals(attempt.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài thi đã kết thúc và bị khóa");
        }
    }

    private void saveAttempt(Attempt attempt) throws Exception {
        firestore.collection("attempts").document(attempt.getId()).set(attempt).get();
    }
}
