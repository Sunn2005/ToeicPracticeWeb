package com.toeic.service;

import com.toeic.dao.AttemptDao;
import com.toeic.dto.AttemptResultDto;
import com.toeic.model.AttemptResult;
import com.toeic.model.Attempt;
import com.toeic.model.AttemptAnswer;
import com.toeic.model.enums.AttemptSection;
import com.toeic.model.enums.AttemptStatus;
import com.toeic.model.enums.ExamMode;
import com.toeic.model.enums.TestType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
public class AttemptService {

    public static final String FULL_TEST = TestType.FULL_TEST.name();
    public static final String PRACTICE = TestType.PRACTICE.name();
    public static final String IN_PROGRESS = AttemptStatus.IN_PROGRESS.name();
    public static final String COMPLETED = AttemptStatus.COMPLETED.name();
    public static final String LISTENING = AttemptSection.LISTENING.name();
    public static final String READING = AttemptSection.READING.name();
    public static final String AWAITING_SUBMISSION = AttemptSection.AWAITING_SUBMISSION.name();
    public static final String FINISHED = AttemptSection.FINISHED.name();
    public static final String MODE_FULL = "FULL";
    public static final String MODE_LISTENING = "LISTENING";
    public static final String MODE_READING = "READING";
    public static final String MODE_PART = "PART";

    private static final long LISTENING_DURATION_MS = 45L * 60L * 1000L;
    private static final long READING_DURATION_MS = 75L * 60L * 1000L;
    private static final long FULL_TEST_DURATION_MS = LISTENING_DURATION_MS + READING_DURATION_MS;
    private static final int MIN_CUSTOM_DURATION_MINUTES = 1;
    private static final int MAX_CUSTOM_DURATION_MINUTES = 180;
    private static final int[][] PART_RANGES = {
            {1, 6}, {7, 31}, {32, 70}, {71, 100},
            {101, 130}, {131, 146}, {147, 200}
    };
    private static final int[] PART_SUGGESTED_MINUTES = {5, 10, 15, 15, 20, 10, 45};

    private final AttemptDao attemptDao;
    private final TestService testService;

    public AttemptService(AttemptDao attemptDao, TestService testService) {
        this.attemptDao = attemptDao;
        this.testService = testService;
    }

    public Map<String, Object> createOrResume(String userId, String testId) throws Exception {
        return createOrResume(userId, testId, MODE_FULL, null);
    }

    public Map<String, Object> createOrResume(
            String userId,
            String testId,
            String requestedMode,
            Integer selectedPart
    ) throws Exception {
        return createOrResume(userId, testId, requestedMode, selectedPart, null, null);
    }

    public Map<String, Object> createOrResume(
            String userId,
            String testId,
            String requestedMode,
            Integer selectedPart,
            List<Integer> requestedParts,
            Integer durationMinutes
    ) throws Exception {
        return createOrResume(
                userId,
                testId,
                requestedMode,
                selectedPart,
                requestedParts,
                durationMinutes,
                null
        );
    }

    public Map<String, Object> createOrResume(
            String userId,
            String testId,
            String requestedMode,
            Integer selectedPart,
            List<Integer> requestedParts,
            Integer durationMinutes,
            String requestedType
    ) throws Exception {
        return createOrResume(
                userId,
                testId,
                requestedMode,
                selectedPart,
                requestedParts,
                durationMinutes,
                requestedType,
                false
        );
    }

    public Map<String, Object> createOrResume(
            String userId,
            String testId,
            String requestedMode,
            Integer selectedPart,
            List<Integer> requestedParts,
            Integer durationMinutes,
            String requestedType,
            Boolean restartExisting
    ) throws Exception {
        testService.getMetadata(testId);
        AttemptScope scope = resolveScope(requestedMode, selectedPart, requestedParts, durationMinutes);
        String attemptType = normalizeAttemptType(requestedType);
        boolean timed = !PRACTICE.equals(attemptType) || durationMinutes != null;

        Attempt active = findCurrentAttempt(
                userId,
                testId,
                scope.mode(),
                scope.selectedParts(),
                attemptType
        );
        if (active != null) {
            active = reconcileTimeout(active);
            if (IN_PROGRESS.equals(active.getStatus())) {
                if (Boolean.TRUE.equals(restartExisting)) {
                    attemptDao.delete(active.getId());
                } else {
                    Map<String, Object> response = toResponse(active, true);
                    response.put("resumed", true);
                    return response;
                }
            }
        }

        long now = System.currentTimeMillis();
        Attempt attempt = new Attempt();
        attempt.setId(attemptDao.nextId());
        attempt.setUserId(userId);
        attempt.setTestId(testId);
        attempt.setType(attemptType);
        attempt.setMode(scope.mode());
        attempt.setSelectedPart(scope.selectedPart());
        attempt.setSelectedParts(scope.selectedParts());
        attempt.setTimed(timed);
        attempt.setTimeLimitSeconds(timed
                ? Math.toIntExact(
                        (MODE_FULL.equals(scope.mode()) ? FULL_TEST_DURATION_MS : scope.durationMs()) / 1000L
                )
                : null);
        attempt.setStatus(IN_PROGRESS);
        attempt.setCurrentSection(scope.section());
        attempt.setCurrentQuestionNumber(scope.firstQuestion());
        attempt.setFirstQuestionNumber(scope.firstQuestion());
        attempt.setLastQuestionNumber(scope.lastQuestion());
        attempt.setTotalQuestions(scope.totalQuestions());
        attempt.setStartedAt(now);
        attempt.setUpdatedAt(now);
        attempt.setSectionStartedAt(now);
        attempt.setSectionEndAt(timed ? now + scope.durationMs() : null);
        attempt.setOverallEndAt(timed
                ? now + (MODE_FULL.equals(scope.mode()) ? FULL_TEST_DURATION_MS : scope.durationMs())
                : null);
        if (LISTENING.equals(scope.section())) {
            attempt.setListeningStartedAt(now);
            attempt.setListeningEndAt(timed ? now + scope.durationMs() : null);
        } else {
            attempt.setReadingStartedAt(now);
            attempt.setReadingEndAt(timed ? now + scope.durationMs() : null);
        }
        attempt.setSubmittedAt(null);
        attempt.setScore(null);
        attempt.setResult(null);
        attempt.setAiAnalysisStatus("NOT_REQUESTED");
        attempt.setAiAnalysisId(null);
        attempt.setAiAnalysisRequestedAt(null);
        attempt.setAnswers(null);

        attemptDao.save(attempt);
        Map<String, Object> response = toResponse(attempt, true);
        response.put("resumed", false);
        return response;
    }

    public Map<String, Object> getCurrent(String userId, String testId) throws Exception {
        Attempt active = findCurrentAttempt(
                userId,
                testId,
                MODE_FULL,
                List.of(1, 2, 3, 4, 5, 6, 7),
                FULL_TEST
        );
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
        response.put("test", testService.getExamTest(attempt.getTestId(), selectedParts(attempt)));
        return response;
    }

    public Map<String, Object> getPracticeFeedback(
            String userId,
            String attemptId,
            Integer questionNumber
    ) throws Exception {
        if (questionNumber == null || questionNumber < 1 || questionNumber > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "questionNumber phải từ 1 đến 200");
        }

        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        requireInProgress(attempt);
        if (!PRACTICE.equals(attemptType(attempt))) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phản hồi tức thì chỉ áp dụng cho chế độ luyện tập"
            );
        }
        if (!isQuestionSelected(attempt, questionNumber)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Câu hỏi không thuộc phạm vi luyện tập"
            );
        }

        return testService.getPracticeFeedback(
                attempt.getTestId(),
                questionNumber,
                loadAnswers(attempt.getId())
        );
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
        if (!isQuestionSelected(attempt, questionNumber)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Câu hỏi không thuộc phạm vi của chế độ thi này"
            );
        }

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
        AttemptAnswer answer = new AttemptAnswer(questionNumber, normalizedAnswer, now);
        attemptDao.saveAnswer(attemptId, answer);

        attempt.setUpdatedAt(now);
        attemptDao.updateTimestamp(attemptId, now);

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
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        requireInProgress(attempt);
        if (!READING.equals(attempt.getCurrentSection())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chưa đến phần Reading");
        }
        if (questionNumber == null
                || questionNumber < 101
                || !isQuestionSelected(attempt, questionNumber)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Câu Reading không thuộc phạm vi của chế độ thi này"
            );
        }

        attempt.setCurrentQuestionNumber(questionNumber);
        attempt.setUpdatedAt(System.currentTimeMillis());
        saveAttempt(attempt);
        return toResponse(attempt, true);
    }

    public Map<String, Object> nextListening(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (COMPLETED.equals(attempt.getStatus())) {
            return toResponse(attempt, true);
        }
        requireInProgress(attempt);

        if (READING.equals(attempt.getCurrentSection())) {
            return toResponse(attempt, true);
        }
        if (!LISTENING.equals(attempt.getCurrentSection())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không ở phần Listening");
        }

        int currentStart = listeningUnitStart(attempt.getCurrentQuestionNumber());
        Integer next = nextSelectedListeningUnit(attempt, currentStart);
        if (next == null) {
            if (hasSelectedReadingPart(attempt)) {
                transitionToReading(attempt, System.currentTimeMillis());
                saveAttempt(attempt);
            } else {
                markListeningReadyToSubmit(attempt);
                saveAttempt(attempt);
            }
        } else {
            attempt.setCurrentQuestionNumber(next);
            attempt.setUpdatedAt(System.currentTimeMillis());
            saveAttempt(attempt);
        }

        return toResponse(attempt, true);
    }

    public Map<String, Object> finishListening(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (COMPLETED.equals(attempt.getStatus())) {
            return toResponse(attempt, true);
        }
        requireInProgress(attempt);

        if (LISTENING.equals(attempt.getCurrentSection())) {
            if (hasSelectedReadingPart(attempt)) {
                transitionToReading(attempt, System.currentTimeMillis());
                saveAttempt(attempt);
            } else {
                attempt = submitInternal(attempt, true);
            }
        }
        return toResponse(attempt, true);
    }

    public AttemptResultDto submit(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (COMPLETED.equals(attempt.getStatus())) {
            return AttemptResultDto.from(attempt.getResult());
        }
        requireInProgress(attempt);
        if (FULL_TEST.equals(attemptType(attempt))
                && MODE_FULL.equals(mode(attempt))
                && !READING.equals(attempt.getCurrentSection())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Hãy hoàn thành Listening trước khi nộp Full Test"
            );
        }
        return AttemptResultDto.from(submitInternal(attempt, false).getResult());
    }

    public AttemptResultDto submitForReview(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (COMPLETED.equals(attempt.getStatus())) {
            return AttemptResultDto.from(attempt.getResult());
        }
        requireInProgress(attempt);
        return AttemptResultDto.from(submitInternal(attempt, false).getResult());
    }

    public AttemptResultDto getResult(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (!COMPLETED.equals(attempt.getStatus()) || attempt.getResult() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài thi chưa được nộp");
        }
        return AttemptResultDto.from(attempt.getResult());
    }

    public Map<String, Object> getReview(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (!COMPLETED.equals(attempt.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chỉ được xem đáp án sau khi nộp bài");
        }

        Map<Integer, String> answers = loadAnswers(attempt.getId());
        Map<String, Object> reviewTest = testService.addReviewAnswers(
                testService.getReviewTest(attempt.getTestId(), selectedParts(attempt)),
                answers
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("attempt", toResponse(attempt, true));
        response.put("result", attempt.getResult());
        response.put("aiAnalysisStatus", attempt.getAiAnalysisStatus() == null
                ? "NOT_REQUESTED"
                : attempt.getAiAnalysisStatus());
        response.put("aiAnalysisId", attempt.getAiAnalysisId());
        response.put("test", reviewTest);
        return response;
    }

    private Attempt findCurrentAttempt(
            String userId,
            String testId,
            String requestedMode,
            List<Integer> requestedParts,
            String requestedType
    ) throws Exception {
        List<Attempt> candidates = new ArrayList<>();
        for (Attempt attempt : attemptDao.findByUserId(userId)) {
            applyLegacyScope(attempt);
            if (testId.equals(attempt.getTestId())
                    && requestedType.equals(attemptType(attempt))
                    && requestedMode.equals(mode(attempt))
                    && Objects.equals(requestedParts, selectedParts(attempt))
                    && IN_PROGRESS.equals(attempt.getStatus())) {
                candidates.add(attempt);
            }
        }

        return candidates.stream()
                .max(Comparator.comparing(attempt -> attempt.getStartedAt() == null ? 0L : attempt.getStartedAt()))
                .orElse(null);
    }

    private Attempt getOwnedAttempt(String userId, String attemptId) throws Exception {
        Attempt attempt = attemptDao.findById(attemptId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bài làm")
        );
        if (!userId.equals(attempt.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập bài làm này");
        }
        String type = attemptType(attempt);
        if (!FULL_TEST.equals(type) && !PRACTICE.equals(type)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Loại lượt làm này không được hỗ trợ");
        }
        applyLegacyScope(attempt);
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
            if (MODE_FULL.equals(mode(attempt))) {
                transitionToReading(attempt, attempt.getSectionEndAt());
                saveAttempt(attempt);
            } else {
                return submitInternal(attempt, true);
            }
        }

        if (READING.equals(attempt.getCurrentSection())
                && attempt.getSectionEndAt() != null
                && now >= attempt.getSectionEndAt()) {
            return submitInternal(attempt, true);
        }
        if (AWAITING_SUBMISSION.equals(attempt.getCurrentSection())
                && attempt.getSectionEndAt() != null
                && now >= attempt.getSectionEndAt()) {
            return submitInternal(attempt, true);
        }
        return attempt;
    }

    private void markListeningReadyToSubmit(Attempt attempt) {
        long now = System.currentTimeMillis();
        attempt.setCurrentSection(AWAITING_SUBMISSION);
        attempt.setListeningEndAt(now);
        attempt.setUpdatedAt(now);
    }

    private void transitionToReading(Attempt attempt, long readingStart) {
        long now = System.currentTimeMillis();
        attempt.setCurrentSection(READING);
        attempt.setCurrentQuestionNumber(firstSelectedReadingQuestion(attempt));
        attempt.setListeningEndAt(readingStart);
        attempt.setReadingStartedAt(readingStart);
        attempt.setSectionStartedAt(readingStart);
        if (isTimed(attempt) && MODE_FULL.equals(mode(attempt))) {
            attempt.setReadingEndAt(readingStart + READING_DURATION_MS);
            attempt.setSectionEndAt(readingStart + READING_DURATION_MS);
            attempt.setOverallEndAt(readingStart + READING_DURATION_MS);
        } else if (isTimed(attempt)) {
            Long sessionEnd = attempt.getOverallEndAt() == null
                    ? attempt.getSectionEndAt()
                    : attempt.getOverallEndAt();
            attempt.setReadingEndAt(sessionEnd);
            attempt.setSectionEndAt(sessionEnd);
        } else {
            attempt.setReadingEndAt(null);
            attempt.setSectionEndAt(null);
            attempt.setOverallEndAt(null);
        }
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

        int firstQuestion = firstQuestion(attempt);
        int lastQuestion = lastQuestion(attempt);
        List<Integer> questionNumbers = selectedQuestionNumbers(attempt);
        int listeningTotal = (int) questionNumbers.stream().filter(number -> number <= 100).count();
        int readingTotal = questionNumbers.size() - listeningTotal;

        int listeningCorrect = 0;
        int readingCorrect = 0;
        int listeningAnswered = 0;
        int readingAnswered = 0;

        for (int number : questionNumbers) {
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
        int listeningScore = ToeicScoreConverter.listeningScore(listeningCorrect, listeningTotal);
        int readingScore = ToeicScoreConverter.readingScore(readingCorrect, readingTotal);
        int totalQuestions = questionNumbers.size();

        AttemptResult result = AttemptResult.builder()
                .attemptId(attempt.getId())
                .testId(attempt.getTestId())
                .type(attemptType(attempt))
                .mode(mode(attempt))
                .selectedPart(attempt.getSelectedPart())
                .selectedParts(selectedParts(attempt))
                .timeLimitSeconds(attempt.getTimeLimitSeconds())
                .timed(isTimed(attempt))
                .firstQuestionNumber(firstQuestion)
                .lastQuestionNumber(lastQuestion)
                .listeningTotalQuestions(listeningTotal)
                .readingTotalQuestions(readingTotal)
                .listeningCorrect(listeningCorrect)
                .listeningWrong(listeningAnswered - listeningCorrect)
                .listeningUnanswered(listeningTotal - listeningAnswered)
                .readingCorrect(readingCorrect)
                .readingWrong(readingAnswered - readingCorrect)
                .readingUnanswered(readingTotal - readingAnswered)
                .totalCorrect(listeningCorrect + readingCorrect)
                .totalWrong(listeningAnswered + readingAnswered - listeningCorrect - readingCorrect)
                .totalUnanswered(totalQuestions - listeningAnswered - readingAnswered)
                .totalQuestions(totalQuestions)
                .correctCount(listeningCorrect + readingCorrect)
                .incorrectCount(listeningAnswered + readingAnswered - listeningCorrect - readingCorrect)
                .unansweredCount(totalQuestions - listeningAnswered - readingAnswered)
                .listeningScore(listeningScore)
                .readingScore(readingScore)
                .totalScore(listeningScore + readingScore)
                .estimatedTotalScore(listeningScore + readingScore)
                .durationSeconds(Math.max(0, (submittedAt - attempt.getStartedAt()) / 1000))
                .submittedAt(submittedAt)
                .autoSubmitted(autoSubmitted)
                .build();

        attempt.setStatus(COMPLETED);
        attempt.setCurrentSection(FINISHED);
        attempt.setSubmittedAt(submittedAt);
        attempt.setUpdatedAt(submittedAt);
        attempt.setScore(listeningScore + readingScore);
        attempt.setResult(result);
        saveAttempt(attempt);
        return attempt;
    }

    private Map<Integer, String> loadAnswers(String attemptId) throws Exception {
        return attemptDao.findAnswers(attemptId);
    }

    private Map<String, Object> toResponse(Attempt attempt, boolean includeAnswers) throws Exception {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", attempt.getId());
        response.put("testId", attempt.getTestId());
        response.put("type", attempt.getType());
        response.put("mode", mode(attempt));
        response.put("selectedPart", attempt.getSelectedPart());
        response.put("selectedParts", selectedParts(attempt));
        response.put("timeLimitSeconds", attempt.getTimeLimitSeconds());
        response.put("timed", isTimed(attempt));
        response.put("status", attempt.getStatus());
        response.put("currentSection", attempt.getCurrentSection());
        response.put("currentQuestionNumber", attempt.getCurrentQuestionNumber());
        response.put("firstQuestionNumber", firstQuestion(attempt));
        response.put("lastQuestionNumber", lastQuestion(attempt));
        response.put("totalQuestions", totalQuestions(attempt));
        response.put("startedAt", attempt.getStartedAt());
        response.put("updatedAt", attempt.getUpdatedAt());
        response.put("submittedAt", attempt.getSubmittedAt());
        response.put("sectionStartedAt", attempt.getSectionStartedAt());
        response.put("sectionEndAt", attempt.getSectionEndAt());
        response.put("overallEndAt", attempt.getOverallEndAt() == null
                ? attempt.getSectionEndAt()
                : attempt.getOverallEndAt());
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

    private AttemptScope resolveScope(
            String requestedMode,
            Integer selectedPart,
            List<Integer> requestedParts,
            Integer durationMinutes
    ) {
        String normalizedMode = requestedMode == null || requestedMode.isBlank()
                ? MODE_FULL
                : requestedMode.trim().toUpperCase(Locale.ROOT);
        ExamMode examMode;
        try {
            examMode = ExamMode.valueOf(normalizedMode);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "mode chỉ nhận FULL, LISTENING, READING hoặc PART"
            );
        }

        return switch (examMode) {
            case FULL -> new AttemptScope(
                    MODE_FULL, null, List.of(1, 2, 3, 4, 5, 6, 7),
                    LISTENING, 1, 200, 200, LISTENING_DURATION_MS
            );
            case LISTENING -> new AttemptScope(
                    MODE_LISTENING, null, List.of(1, 2, 3, 4),
                    LISTENING, 1, 100, 100, LISTENING_DURATION_MS
            );
            case READING -> new AttemptScope(
                    MODE_READING, null, List.of(5, 6, 7),
                    READING, 101, 200, 100, READING_DURATION_MS
            );
            case PART -> resolvePartScope(selectedPart, requestedParts, durationMinutes);
        };
    }

    private AttemptScope resolvePartScope(
            Integer selectedPart,
            List<Integer> requestedParts,
            Integer durationMinutes
    ) {
        List<Integer> parts = new ArrayList<>();
        if (requestedParts != null) {
            parts.addAll(requestedParts);
        }
        if (parts.isEmpty() && selectedPart != null) {
            parts.add(selectedPart);
        }
        if (parts.isEmpty() || parts.stream().anyMatch(part -> part == null || part < 1 || part > 7)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chế độ PART cần ít nhất một part từ 1 đến 7"
            );
        }
        parts = parts.stream().distinct().sorted().toList();

        int resolvedDurationMinutes = durationMinutes == null
                ? parts.stream().mapToInt(part -> PART_SUGGESTED_MINUTES[part - 1]).sum()
                : durationMinutes;
        if (resolvedDurationMinutes < MIN_CUSTOM_DURATION_MINUTES
                || resolvedDurationMinutes > MAX_CUSTOM_DURATION_MINUTES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thời gian tự đặt phải từ 1 đến 180 phút"
            );
        }

        int first = PART_RANGES[parts.getFirst() - 1][0];
        int last = PART_RANGES[parts.getLast() - 1][1];
        int totalQuestions = parts.stream()
                .mapToInt(part -> PART_RANGES[part - 1][1] - PART_RANGES[part - 1][0] + 1)
                .sum();
        return new AttemptScope(
                MODE_PART,
                parts.size() == 1 ? parts.getFirst() : null,
                parts,
                parts.getFirst() <= 4 ? LISTENING : READING,
                first,
                last,
                totalQuestions,
                resolvedDurationMinutes * 60L * 1000L
        );
    }

    private void applyLegacyScope(Attempt attempt) {
        if (attempt.getMode() == null || attempt.getMode().isBlank()) {
            attempt.setMode(MODE_FULL);
        }
        List<Integer> parts = selectedParts(attempt);
        attempt.setSelectedParts(parts);
        attempt.setSelectedPart(parts.size() == 1 ? parts.getFirst() : null);
        if (attempt.getFirstQuestionNumber() == null
                || attempt.getLastQuestionNumber() == null
                || attempt.getTotalQuestions() == null) {
            attempt.setFirstQuestionNumber(PART_RANGES[parts.getFirst() - 1][0]);
            attempt.setLastQuestionNumber(PART_RANGES[parts.getLast() - 1][1]);
            attempt.setTotalQuestions(parts.stream()
                    .mapToInt(part -> PART_RANGES[part - 1][1] - PART_RANGES[part - 1][0] + 1)
                    .sum());
        }
        if (attempt.getTimed() == null) {
            attempt.setTimed(!PRACTICE.equals(attemptType(attempt)));
        }
        if (isTimed(attempt) && attempt.getTimeLimitSeconds() == null) {
            if (attempt.getStartedAt() != null && attempt.getOverallEndAt() != null) {
                attempt.setTimeLimitSeconds(Math.toIntExact(
                        Math.max(0L, (attempt.getOverallEndAt() - attempt.getStartedAt()) / 1000L)
                ));
            } else {
                attempt.setTimeLimitSeconds(defaultTimeLimitSeconds(attempt));
            }
        }
        if (isTimed(attempt) && attempt.getOverallEndAt() == null) {
            if (MODE_FULL.equals(mode(attempt)) && attempt.getStartedAt() != null) {
                attempt.setOverallEndAt(attempt.getStartedAt() + FULL_TEST_DURATION_MS);
            } else {
                attempt.setOverallEndAt(attempt.getSectionEndAt());
            }
        }
    }

    private String mode(Attempt attempt) {
        return attempt.getMode() == null || attempt.getMode().isBlank()
                ? MODE_FULL
                : attempt.getMode();
    }

    private String normalizeAttemptType(String requestedType) {
        if (requestedType == null || requestedType.isBlank()) {
            return FULL_TEST;
        }
        String normalized = requestedType.trim().toUpperCase(Locale.ROOT);
        if (!FULL_TEST.equals(normalized) && !PRACTICE.equals(normalized)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "type phải là FULL_TEST hoặc PRACTICE"
            );
        }
        return normalized;
    }

    private String attemptType(Attempt attempt) {
        return attempt.getType() == null || attempt.getType().isBlank()
                ? FULL_TEST
                : attempt.getType();
    }

    private boolean isTimed(Attempt attempt) {
        return !Boolean.FALSE.equals(attempt.getTimed());
    }

    private int firstQuestion(Attempt attempt) {
        return attempt.getFirstQuestionNumber() == null ? 1 : attempt.getFirstQuestionNumber();
    }

    private int lastQuestion(Attempt attempt) {
        return attempt.getLastQuestionNumber() == null ? 200 : attempt.getLastQuestionNumber();
    }

    private int totalQuestions(Attempt attempt) {
        return attempt.getTotalQuestions() == null
                ? lastQuestion(attempt) - firstQuestion(attempt) + 1
                : attempt.getTotalQuestions();
    }

    private List<Integer> selectedParts(Attempt attempt) {
        if (attempt.getSelectedParts() != null && !attempt.getSelectedParts().isEmpty()) {
            return attempt.getSelectedParts().stream().distinct().sorted().toList();
        }
        if (attempt.getSelectedPart() != null) {
            return List.of(attempt.getSelectedPart());
        }
        return switch (mode(attempt)) {
            case MODE_LISTENING -> List.of(1, 2, 3, 4);
            case MODE_READING -> List.of(5, 6, 7);
            default -> List.of(1, 2, 3, 4, 5, 6, 7);
        };
    }

    private int defaultTimeLimitSeconds(Attempt attempt) {
        return switch (mode(attempt)) {
            case MODE_FULL -> (int) (FULL_TEST_DURATION_MS / 1000L);
            case MODE_LISTENING -> (int) (LISTENING_DURATION_MS / 1000L);
            case MODE_READING -> (int) (READING_DURATION_MS / 1000L);
            default -> selectedParts(attempt).stream()
                    .mapToInt(part -> PART_SUGGESTED_MINUTES[part - 1] * 60)
                    .sum();
        };
    }

    private boolean isQuestionSelected(Attempt attempt, int questionNumber) {
        int part = partForQuestion(questionNumber);
        return part > 0 && selectedParts(attempt).contains(part);
    }

    private int partForQuestion(int questionNumber) {
        for (int index = 0; index < PART_RANGES.length; index++) {
            if (questionNumber >= PART_RANGES[index][0] && questionNumber <= PART_RANGES[index][1]) {
                return index + 1;
            }
        }
        return -1;
    }

    private List<Integer> selectedQuestionNumbers(Attempt attempt) {
        List<Integer> questionNumbers = new ArrayList<>();
        for (int part : selectedParts(attempt)) {
            for (int number = PART_RANGES[part - 1][0]; number <= PART_RANGES[part - 1][1]; number++) {
                questionNumbers.add(number);
            }
        }
        return questionNumbers;
    }

    private boolean hasSelectedReadingPart(Attempt attempt) {
        return selectedParts(attempt).stream().anyMatch(part -> part >= 5);
    }

    private int firstSelectedReadingQuestion(Attempt attempt) {
        return selectedParts(attempt).stream()
                .filter(part -> part >= 5)
                .findFirst()
                .map(part -> PART_RANGES[part - 1][0])
                .orElse(101);
    }

    private Integer nextSelectedListeningUnit(Attempt attempt, int currentStart) {
        int candidate = currentStart < 31
                ? currentStart + 1
                : currentStart == 31 ? 32 : currentStart + 3;
        while (candidate <= 100) {
            if (isQuestionSelected(attempt, candidate)) {
                return candidate;
            }
            candidate = candidate < 31
                    ? candidate + 1
                    : candidate == 31 ? 32 : candidate + 3;
        }
        return null;
    }

    private void requireInProgress(Attempt attempt) {
        if (!IN_PROGRESS.equals(attempt.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Bài thi đã kết thúc và bị khóa");
        }
    }

    private void saveAttempt(Attempt attempt) throws Exception {
        attemptDao.save(attempt);
    }

    private record AttemptScope(
            String mode,
            Integer selectedPart,
            List<Integer> selectedParts,
            String section,
            int firstQuestion,
            int lastQuestion,
            int totalQuestions,
            long durationMs
    ) {
    }
}
