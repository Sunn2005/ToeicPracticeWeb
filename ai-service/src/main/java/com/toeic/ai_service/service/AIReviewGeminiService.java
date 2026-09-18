package com.toeic.ai_service.service;

import com.toeic.ai_service.model.GeminiAnalysis;
import com.toeic.ai_service.model.GeminiAnalysisBundle;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewStatistics;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.Objects;
import java.util.List;

@Service
public class AIReviewGeminiService {

    private static final String SYSTEM_PROMPT = """
            Bạn là trợ lý phân tích kết quả TOEIC Listening và Reading.

            QUY TẮC NGÔN NGỮ BẮT BUỘC:
            - Mỗi request chỉ tạo đúng một bản phân tích theo ngôn ngữ được yêu cầu trong user prompt.
              Không được trộn tiếng Việt và tiếng Anh trong cùng một câu.
            - Quy tắc này áp dụng cho headline, overallComment, mọi title, message, recommendation,
              summary, name, explanation, reason, goal, topicsToReview, nhan đề ngày học,
              nhan đề bài tập, label của nextActions và limitations.
            - Mã tag lấy từ input, tên field JSON và enum như LOW, MEDIUM, HIGH, STRONG,
              NEEDS_IMPROVEMENT phải giữ nguyên trong cả hai bản.
            - Bản tiếng Việt có thể giữ thuật ngữ TOEIC quen thuộc khi cần (Listening, Reading,
              Part 1–7, Word Form), nhưng phần giải thích xung quanh phải là tiếng Việt.

            YÊU CẦU VỀ MỨC ĐỘ CHI TIẾT:
            - overallComment tối thiểu 25 từ: nêu bức tranh chung, chênh lệch giữa kỹ năng tốt và
              kỹ năng cần ưu tiên, rồi định hướng học ngắn gọn.
            - Mỗi strength.message tối thiểu 15 từ: nói rõ người học làm tốt kỹ năng nào và số liệu
              evidence cho thấy điều gì. Không chỉ viết một câu khen chung chung.
            - Mỗi weakness.message tối thiểu 15 từ và recommendation tối thiểu 12 từ: giải thích
              biểu hiện sai, tác động khi làm bài và một cách luyện cụ thể.
            - Mỗi partAnalysis.summary tối thiểu 18 từ và phải gồm: nhận định theo accuracy,
              kỹ năng/tag nổi bật hoặc còn yếu nếu dữ liệu có, cùng một bước luyện tiếp theo.
            - Mỗi knowledgeGap.explanation và priorityTopic.reason tối thiểu 12 từ;
              priorityTopic.goal tối thiểu 8 từ. Kế hoạch học và hành động tiếp theo phải cụ thể,
              có thể thực hiện và dùng đúng ngôn ngữ của từng bản.

            Chỉ nhận xét dựa trên dữ liệu được cung cấp.
            Không tự tạo điểm số, số câu đúng hoặc sai, question number, skill tag,
            grammar tag, thời gian làm bài hoặc bằng chứng không có trong input.
            Mỗi điểm mạnh và điểm yếu phải có evidence.
            Nếu sampleSize nhỏ hơn 3, không được kết luận chắc chắn và confidence phải là LOW.
            Không suy đoán trạng thái tâm lý hoặc nguyên nhân cá nhân của người học.
            Bản phân tích phải rõ ràng, thân thiện và dễ hiểu.
            Trong bản tiếng Việt, xưng hô với người học là "bạn".
            Ưu tiên lời khuyên cụ thể, có thể thực hiện và phù hợp với kết quả bài làm.
            Không có dữ liệu điểm mục tiêu: targetScore và scoreGap phải là null.
            Không có dữ liệu thời gian từng Part: timeManagement.available phải là false,
            status phải là INSUFFICIENT_DATA và recommendations phải là mảng rỗng.
            partAnalysis phải có đủ và chỉ một mục cho từng Part 1 đến 7.
            priorityTopics phải có đúng 3 mục. studyPlan phải có đúng 7 ngày.
            Không được bỏ sót field trong bất kỳ object nào. Các field số và boolean
            bắt buộc phải có giá trị; field không có dữ liệu nhưng cho phép null thì trả về null;
            field dạng danh sách không có dữ liệu thì trả về mảng rỗng.
            Mỗi evidence bắt buộc có correct, total, accuracy, questionNumbers
            và wrongQuestionNumbers lấy đúng từ input.
            Chỉ sử dụng tag có trong input.
            Chỉ trả về JSON đúng schema được cung cấp.
            """;

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final AIReviewValidator validator;
    private final int maxAttempts;
    private final long initialBackoffMs;

    public AIReviewGeminiService(
            ChatClient.Builder builder,
            ObjectMapper objectMapper,
            AIReviewValidator validator,
            @Value("${app.ai.review.max-attempts:3}") int maxAttempts,
            @Value("${app.ai.review.initial-backoff-ms:1000}") long initialBackoffMs
    ) {
        this.chatClient = builder.build();
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.initialBackoffMs = Math.max(0, initialBackoffMs);
    }

    public Generation analyze(ReviewInput input, ReviewStatistics statistics) {
        List<EvidenceQuestion> evidenceQuestions = input.questions().stream()
                .map(question -> new EvidenceQuestion(
                        question.questionNumber(),
                        question.partNumber(),
                        question.questionType(),
                        question.skillTags(),
                        question.grammarTags(),
                        question.difficulty(),
                        question.correct(),
                        question.unanswered()
                ))
                .toList();
        String payload = serialize(new PromptInput(statistics, evidenceQuestions));
        LocalizedGeneration vi = analyzeLocalized(input, statistics, payload, "vi");
        try {
            LocalizedGeneration en = analyzeLocalized(input, statistics, payload, "en");
            return new Generation(
                    new GeminiAnalysisBundle(vi.analysis(), en.analysis()),
                    vi.retryCount() + en.retryCount()
            );
        } catch (AIReviewGenerationException exception) {
            throw new AIReviewGenerationException(
                    exception.errorCode(),
                    vi.retryCount() + exception.retryCount(),
                    exception.getCause()
            );
        }
    }

    private LocalizedGeneration analyzeLocalized(
            ReviewInput input,
            ReviewStatistics statistics,
            String payload,
            String locale
    ) {
        RuntimeException lastFailure = null;
        boolean usedSchemaRepair = false;
        int attemptsMade = 0;
        String repairInstruction = "";

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            attemptsMade = attempt;
            try {
                GeminiAnalysis analysis = chatClient.prompt()
                        .system(SYSTEM_PROMPT)
                        .user(localeInstruction(locale)
                                + "\n\nDữ liệu đã được hệ thống tính và kiểm chứng:\n"
                                + payload + repairInstruction)
                        .call()
                        .entity(GeminiAnalysis.class, spec -> spec.useProviderStructuredOutput());
                analysis = normalizeDeterministicFields(
                        Objects.requireNonNull(analysis, "Gemini trả về kết quả rỗng"),
                        statistics,
                        locale
                );
                validator.validate(analysis, input, statistics, locale);
                return new LocalizedGeneration(analysis, attempt - 1);
            } catch (AIReviewValidator.InvalidAIAnalysisException exception) {
                lastFailure = exception;
                if (usedSchemaRepair) {
                    break;
                }
                usedSchemaRepair = true;
                repairInstruction = repairInstruction(exception, locale);
            } catch (RuntimeException exception) {
                lastFailure = exception;
                if (isInvalidOutput(exception)) {
                    if (usedSchemaRepair) {
                        break;
                    }
                    usedSchemaRepair = true;
                    repairInstruction = repairInstruction(exception, locale);
                    continue;
                }
                if (!isTransient(exception) || attempt == maxAttempts) {
                    break;
                }
                sleep(backoff(attempt));
            }
        }
        throw new AIReviewGenerationException(
                errorCode(lastFailure), Math.max(0, attemptsMade - 1), lastFailure
        );
    }

    private String localeInstruction(String locale) {
        if ("en".equals(locale)) {
            return "Generate this analysis in natural English only. All human-readable text "
                    + "must be English; keep JSON field names, enum values, and input tags unchanged.";
        }
        return "Chỉ tạo bản phân tích bằng tiếng Việt tự nhiên, có dấu. Toàn bộ nội dung dành "
                + "cho người đọc phải là tiếng Việt; giữ nguyên tên field JSON, enum và tag từ input.";
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Không thể tạo Gemini input", exception);
        }
    }

    private GeminiAnalysis normalizeDeterministicFields(
            GeminiAnalysis analysis,
            ReviewStatistics statistics,
            String locale
    ) {
        GeminiAnalysis.Summary summary = analysis.summary() == null ? null
                : new GeminiAnalysis.Summary(
                        analysis.summary().headline(),
                        analysis.summary().overallComment(),
                        statistics.totalScore(),
                        null,
                        null
                );

        List<GeminiAnalysis.Strength> strengths = analysis.strengths() == null ? null
                : analysis.strengths().stream()
                .map(item -> new GeminiAnalysis.Strength(
                        item.title(), item.category(), item.part(), item.tag(), item.message(),
                        normalizeEvidence(item.evidence(), item.tag(), item.part(), statistics),
                        item.confidence()
                ))
                .toList();
        List<GeminiAnalysis.Weakness> weaknesses = analysis.weaknesses() == null ? null
                : analysis.weaknesses().stream()
                .map(item -> new GeminiAnalysis.Weakness(
                        item.title(), item.category(), item.part(), item.tag(), item.priority(),
                        item.message(),
                        normalizeEvidence(item.evidence(), item.tag(), item.part(), statistics),
                        item.recommendation(), item.confidence()
                ))
                .toList();
        List<GeminiAnalysis.PartAnalysis> partAnalysis = analysis.partAnalysis() == null ? null
                : analysis.partAnalysis().stream()
                .map(item -> {
                    ReviewStatistics.Metric metric = statistics.byPart()
                            .get(String.valueOf(item.part()));
                    return new GeminiAnalysis.PartAnalysis(
                            item.part(), metric == null ? item.accuracy() : metric.accuracy(),
                            item.level(), item.summary(), item.strongTags(), item.weakTags()
                    );
                })
                .toList();
        List<GeminiAnalysis.KnowledgeGap> knowledgeGaps = analysis.knowledgeGaps() == null ? null
                : analysis.knowledgeGaps().stream()
                .map(item -> {
                    ReviewStatistics.Metric metric = metricFor(item.tag(), null, statistics);
                    return new GeminiAnalysis.KnowledgeGap(
                            item.category(), item.name(), item.tag(), item.priority(),
                            metric == null ? item.currentAccuracy() : metric.accuracy(),
                            item.targetAccuracy(), item.explanation(), item.topicsToReview()
                    );
                })
                .toList();
        GeminiAnalysis.TimeManagement timeManagement = new GeminiAnalysis.TimeManagement(
                false,
                "INSUFFICIENT_DATA",
                analysis.timeManagement() == null ? insufficientTimeSummary(locale)
                        : analysis.timeManagement().summary(),
                List.of()
        );

        return new GeminiAnalysis(
                summary,
                strengths,
                weaknesses,
                partAnalysis,
                knowledgeGaps,
                timeManagement,
                analysis.priorityTopics(),
                analysis.studyPlan(),
                analysis.nextActions(),
                analysis.overallConfidence(),
                analysis.limitations()
        );
    }

    private String insufficientTimeSummary(String locale) {
        return "en".equals(locale)
                ? "Per-Part timing data is not available for this attempt."
                : "Không có dữ liệu thời gian theo Part cho bài làm này.";
    }

    private GeminiAnalysis.Evidence normalizeEvidence(
            GeminiAnalysis.Evidence evidence,
            String tag,
            Integer part,
            ReviewStatistics statistics
    ) {
        if (evidence == null) {
            return null;
        }
        ReviewStatistics.Metric metric = metricFor(tag, part, statistics);
        if (metric == null) {
            return evidence;
        }
        return new GeminiAnalysis.Evidence(
                metric.correct(),
                metric.sampleSize(),
                metric.accuracy(),
                List.of(),
                List.of()
        );
    }

    private ReviewStatistics.Metric metricFor(
            String tag,
            Integer part,
            ReviewStatistics statistics
    ) {
        if (tag != null && !tag.isBlank()) {
            for (java.util.Map<String, ReviewStatistics.Metric> metrics : List.of(
                    statistics.byQuestionType(), statistics.bySkillTag(),
                    statistics.byGrammarTag(), statistics.byDifficulty()
            )) {
                if (metrics.containsKey(tag)) {
                    return metrics.get(tag);
                }
            }
        }
        return part == null ? null : statistics.byPart().get(String.valueOf(part));
    }

    boolean isTransient(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String value = (current.getClass().getName() + " " + current.getMessage()).toLowerCase();
            if (value.contains("429") || value.contains("500") || value.contains("502")
                    || value.contains("503") || value.contains("504") || value.contains("timeout")
                    || value.contains("connection") || value.contains("temporarily unavailable")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    boolean isInvalidOutput(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof tools.jackson.databind.DatabindException) {
                return true;
            }
            String className = current.getClass().getName();
            if (className.contains("BeanOutputConverter")
                    || className.contains("StructuredOutput")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private String repairInstruction(Throwable failure, String locale) {
        String detail = failure.getMessage();
        if (detail == null || detail.isBlank()) {
            detail = failure.getClass().getSimpleName();
        }
        detail = detail.length() > 500 ? detail.substring(0, 500) : detail;
        if ("en".equals(locale)) {
            return "\n\nThe previous JSON was invalid: " + detail
                    + "\nRegenerate the complete JSON with every schema field present."
                    + " Do not use null for numeric, boolean, or list fields.";
        }
        return "\n\nJSON ở lần trước không hợp lệ: " + detail
                + "\nHãy tạo lại toàn bộ JSON, điền đủ mọi field theo schema."
                + " Không dùng null cho field số, boolean hoặc danh sách.";
    }

    String errorCode(Throwable throwable) {
        if (throwable instanceof AIReviewValidator.InvalidAIAnalysisException
                || isInvalidOutput(throwable)) {
            return "INVALID_GEMINI_OUTPUT";
        }
        return isTransient(throwable) ? "GEMINI_UNAVAILABLE" : "GEMINI_REQUEST_FAILED";
    }

    private long backoff(int attempt) {
        return Math.min(10_000L, initialBackoffMs * (1L << Math.max(0, attempt - 1)));
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AIReviewGenerationException("PROCESSING_INTERRUPTED", 0, exception);
        }
    }

    private record PromptInput(
            ReviewStatistics statistics,
            List<EvidenceQuestion> questions
    ) {
    }

    private record EvidenceQuestion(
            int questionNumber,
            int partNumber,
            String questionType,
            List<String> skillTags,
            List<String> grammarTags,
            String difficulty,
            boolean correct,
            boolean unanswered
    ) {
    }

    public record Generation(GeminiAnalysisBundle analysis, int retryCount) {
    }

    private record LocalizedGeneration(GeminiAnalysis analysis, int retryCount) {
    }

    public static class AIReviewGenerationException extends RuntimeException {
        private final String errorCode;
        private final int retryCount;

        public AIReviewGenerationException(String errorCode, int retryCount, Throwable cause) {
            super(errorCode, cause);
            this.errorCode = errorCode;
            this.retryCount = retryCount;
        }

        public String errorCode() {
            return errorCode;
        }

        public int retryCount() {
            return retryCount;
        }
    }
}
