package com.toeic.service;

import com.toeic.dao.AttemptDao;
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

@Service
public class AttemptService {

    public static final String FULL_TEST = TestType.FULL_TEST.name();
    public static final String IN_PROGRESS = AttemptStatus.IN_PROGRESS.name();
    public static final String COMPLETED = AttemptStatus.COMPLETED.name();
    public static final String LISTENING = AttemptSection.LISTENING.name();
    public static final String READING = AttemptSection.READING.name();
    public static final String FINISHED = AttemptSection.FINISHED.name();
    public static final String MODE_FULL = "FULL";
    public static final String MODE_LISTENING = "LISTENING";
    public static final String MODE_READING = "READING";
    public static final String MODE_PART = "PART";

    private static final long LISTENING_DURATION_MS = 45L * 60L * 1000L;
    private static final long READING_DURATION_MS = 75L * 60L * 1000L;
    private static final long FULL_TEST_DURATION_MS = LISTENING_DURATION_MS + READING_DURATION_MS;

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
        testService.getMetadata(testId);
        AttemptScope scope = resolveScope(requestedMode, selectedPart);

        Attempt active = findCurrentAttempt(userId, testId, scope.mode(), scope.selectedPart());
        if (active != null) {
            active = reconcileTimeout(active);
            if (IN_PROGRESS.equals(active.getStatus())) {
                return toResponse(active, true);
            }
        }

        long now = System.currentTimeMillis();
        Attempt attempt = new Attempt();
        attempt.setId(attemptDao.nextId());
        attempt.setUserId(userId);
        attempt.setTestId(testId);
        attempt.setType(FULL_TEST);
        attempt.setMode(scope.mode());
        attempt.setSelectedPart(scope.selectedPart());
        attempt.setStatus(IN_PROGRESS);
        attempt.setCurrentSection(scope.section());
        attempt.setCurrentQuestionNumber(scope.firstQuestion());
        attempt.setFirstQuestionNumber(scope.firstQuestion());
        attempt.setLastQuestionNumber(scope.lastQuestion());
        attempt.setTotalQuestions(scope.lastQuestion() - scope.firstQuestion() + 1);
        attempt.setStartedAt(now);
        attempt.setUpdatedAt(now);
        attempt.setSectionStartedAt(now);
        attempt.setSectionEndAt(now + scope.durationMs());
        attempt.setOverallEndAt(now + (MODE_FULL.equals(scope.mode())
                ? FULL_TEST_DURATION_MS
                : scope.durationMs()));
        if (LISTENING.equals(scope.section())) {
            attempt.setListeningStartedAt(now);
            attempt.setListeningEndAt(now + scope.durationMs());
        } else {
            attempt.setReadingStartedAt(now);
            attempt.setReadingEndAt(now + scope.durationMs());
        }
        attempt.setSubmittedAt(null);
        attempt.setScore(null);
        attempt.setResult(null);
        attempt.setAnswers(null);

        attemptDao.save(attempt);
        return toResponse(attempt, true);
    }

    public Map<String, Object> getCurrent(String userId, String testId) throws Exception {
        Attempt active = findCurrentAttempt(userId, testId, MODE_FULL, null);
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
        if (questionNumber < firstQuestion(attempt) || questionNumber > lastQuestion(attempt)) {
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
                || questionNumber < Math.max(101, firstQuestion(attempt))
                || questionNumber > lastQuestion(attempt)) {
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
        int currentEnd = listeningUnitEnd(currentStart);
        if (currentEnd >= lastQuestion(attempt)) {
            if (MODE_FULL.equals(mode(attempt))) {
                transitionToReading(attempt, System.currentTimeMillis());
                saveAttempt(attempt);
            } else {
                attempt = submitInternal(attempt, false);
            }
        } else {
            int next = currentStart < 31 ? currentStart + 1 : currentStart == 31 ? 32 : currentStart + 3;
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
            if (MODE_FULL.equals(mode(attempt))) {
                transitionToReading(attempt, System.currentTimeMillis());
                saveAttempt(attempt);
            } else {
                attempt = submitInternal(attempt, true);
            }
        }
        return toResponse(attempt, true);
    }

    public Map<String, Object> submit(String userId, String attemptId) throws Exception {
        Attempt attempt = reconcileTimeout(getOwnedAttempt(userId, attemptId));
        if (COMPLETED.equals(attempt.getStatus())) {
            return attempt.getResult();
        }
        requireInProgress(attempt);
        if (MODE_FULL.equals(mode(attempt)) && !READING.equals(attempt.getCurrentSection())) {
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

    private Attempt findCurrentAttempt(
            String userId,
            String testId,
            String requestedMode,
            Integer selectedPart
    ) throws Exception {
        List<Attempt> candidates = new ArrayList<>();
        for (Attempt attempt : attemptDao.findByUserId(userId)) {
            applyLegacyScope(attempt);
            if (testId.equals(attempt.getTestId())
                    && FULL_TEST.equals(attempt.getType())
                    && requestedMode.equals(mode(attempt))
                    && java.util.Objects.equals(selectedPart, attempt.getSelectedPart())
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
        if (!FULL_TEST.equals(attempt.getType())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Đây không phải attempt luyện thi");
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
        attempt.setOverallEndAt(readingStart + READING_DURATION_MS);
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
        int listeningTotal = Math.max(0, Math.min(100, lastQuestion) - firstQuestion + 1);
        if (firstQuestion > 100) {
            listeningTotal = 0;
        }
        int readingTotal = Math.max(0, lastQuestion - Math.max(101, firstQuestion) + 1);

        int listeningCorrect = 0;
        int readingCorrect = 0;
        int listeningAnswered = 0;
        int readingAnswered = 0;

        for (int number = firstQuestion; number <= lastQuestion; number++) {
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
        int listeningScore = estimateSectionScore(listeningCorrect, listeningTotal);
        int readingScore = estimateSectionScore(readingCorrect, readingTotal);
        int totalQuestions = lastQuestion - firstQuestion + 1;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("attemptId", attempt.getId());
        result.put("testId", attempt.getTestId());
        result.put("mode", mode(attempt));
        result.put("selectedPart", attempt.getSelectedPart());
        result.put("firstQuestionNumber", firstQuestion);
        result.put("lastQuestionNumber", lastQuestion);
        result.put("listeningTotalQuestions", listeningTotal);
        result.put("readingTotalQuestions", readingTotal);
        result.put("listeningCorrect", listeningCorrect);
        result.put("listeningWrong", listeningAnswered - listeningCorrect);
        result.put("listeningUnanswered", listeningTotal - listeningAnswered);
        result.put("readingCorrect", readingCorrect);
        result.put("readingWrong", readingAnswered - readingCorrect);
        result.put("readingUnanswered", readingTotal - readingAnswered);
        result.put("totalCorrect", listeningCorrect + readingCorrect);
        result.put("totalWrong", listeningAnswered + readingAnswered - listeningCorrect - readingCorrect);
        result.put("totalUnanswered", totalQuestions - listeningAnswered - readingAnswered);
        result.put("totalQuestions", totalQuestions);
        result.put("correctCount", listeningCorrect + readingCorrect);
        result.put("incorrectCount", listeningAnswered + readingAnswered - listeningCorrect - readingCorrect);
        result.put("unansweredCount", totalQuestions - listeningAnswered - readingAnswered);
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

    private int estimateSectionScore(int correct, int totalQuestions) {
        if (totalQuestions <= 0) {
            return 0;
        }
        double normalizedCorrect = Math.max(0, Math.min(totalQuestions, correct)) * 100.0 / totalQuestions;
        double rawScore = 5.0 + normalizedCorrect * 4.9;
        return Math.max(5, Math.min(495, (int) Math.round(rawScore / 5.0) * 5));
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

    private AttemptScope resolveScope(String requestedMode, Integer selectedPart) {
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
            case FULL -> new AttemptScope(MODE_FULL, null, LISTENING, 1, 200, LISTENING_DURATION_MS);
            case LISTENING -> new AttemptScope(
                    MODE_LISTENING, null, LISTENING, 1, 100, LISTENING_DURATION_MS
            );
            case READING -> new AttemptScope(
                    MODE_READING, null, READING, 101, 200, READING_DURATION_MS
            );
            case PART -> resolvePartScope(selectedPart);
        };
    }

    private AttemptScope resolvePartScope(Integer selectedPart) {
        if (selectedPart == null || selectedPart < 1 || selectedPart > 7) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chế độ PART cần part từ 1 đến 7");
        }

        int[][] ranges = {
                {1, 6}, {7, 31}, {32, 70}, {71, 100},
                {101, 130}, {131, 146}, {147, 200}
        };
        int first = ranges[selectedPart - 1][0];
        int last = ranges[selectedPart - 1][1];
        boolean isListeningPart = selectedPart <= 4;
        return new AttemptScope(
                MODE_PART,
                selectedPart,
                isListeningPart ? LISTENING : READING,
                first,
                last,
                isListeningPart ? LISTENING_DURATION_MS : READING_DURATION_MS
        );
    }

    private void applyLegacyScope(Attempt attempt) {
        if (attempt.getMode() == null || attempt.getMode().isBlank()) {
            attempt.setMode(MODE_FULL);
        }
        if (attempt.getFirstQuestionNumber() == null
                || attempt.getLastQuestionNumber() == null
                || attempt.getTotalQuestions() == null) {
            AttemptScope scope = resolveScope(attempt.getMode(), attempt.getSelectedPart());
            attempt.setFirstQuestionNumber(scope.firstQuestion());
            attempt.setLastQuestionNumber(scope.lastQuestion());
            attempt.setTotalQuestions(scope.lastQuestion() - scope.firstQuestion() + 1);
        }
        if (attempt.getOverallEndAt() == null) {
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
            String section,
            int firstQuestion,
            int lastQuestion,
            long durationMs
    ) {
    }
}
