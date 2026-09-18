package com.toeic.ai_service.service;

import com.toeic.ai_service.model.GeminiAnalysis;
import com.toeic.ai_service.model.ReviewInput;
import com.toeic.ai_service.model.ReviewQuestion;
import com.toeic.ai_service.model.ReviewStatistics;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class AIReviewValidator {

    private static final Pattern VIETNAMESE_MARKER = Pattern.compile(
            "[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡ"
                    + "ùúụủũưừứựửữỳýỵỷỹđ]"
                    + "|\\b(bạn|câu|phần|nghe|đọc|đúng|sai|luyện|học|cần|nên|với|theo|trong|và|của|không|mục|tiêu|kết|quả|khả|năng)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern ENGLISH_COMMON_WORD = Pattern.compile(
            "\\b(the|you|your|are|is|have|has|with|and|but|need|needs|improve|improvement|"
                    + "difficulty|questions|performance|struggle|struggling|identify|identifying|"
                    + "consistently)\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern ENGLISH_MARKER = Pattern.compile(
            "\\b(the|you|your|are|is|have|has|with|and|but|need|needs|improve|improvement|"
                    + "difficulty|questions|performance|struggle|struggling|identify|identifying|"
                    + "review|practice|focus|building|advanced|consistently|photo|description|"
                    + "grammar|vocabulary|listening|reading|response|inference|skill|accuracy|"
                    + "cohesion|word|forms|context|study|answer|sentence|detail)\\b",
            Pattern.CASE_INSENSITIVE
    );

    public void validate(GeminiAnalysis analysis, ReviewInput input, ReviewStatistics statistics) {
        validate(analysis, input, statistics, "vi");
    }

    public void validate(
            GeminiAnalysis analysis,
            ReviewInput input,
            ReviewStatistics statistics,
            String locale
    ) {
        if (analysis == null || analysis.summary() == null) {
            throw new InvalidAIAnalysisException("Thiếu summary");
        }
        if (analysis.summary().currentScore() == null
                || analysis.summary().currentScore() != statistics.totalScore()) {
            throw new InvalidAIAnalysisException("Gemini đã thay đổi currentScore");
        }
        if (analysis.summary().targetScore() != null || analysis.summary().scoreGap() != null) {
            throw new InvalidAIAnalysisException("Không được tạo targetScore khi input không có dữ liệu");
        }
        requireList(analysis.strengths(), "strengths");
        requireList(analysis.weaknesses(), "weaknesses");
        requireList(analysis.partAnalysis(), "partAnalysis");
        requireList(analysis.knowledgeGaps(), "knowledgeGaps");
        requireList(analysis.priorityTopics(), "priorityTopics");
        requireList(analysis.studyPlan(), "studyPlan");
        requireList(analysis.nextActions(), "nextActions");
        requireList(analysis.limitations(), "limitations");
        if (analysis.timeManagement() == null || analysis.timeManagement().available()) {
            throw new InvalidAIAnalysisException("Không có dữ liệu thời gian để kết luận");
        }
        if (!"INSUFFICIENT_DATA".equals(analysis.timeManagement().status())
                || analysis.timeManagement().recommendations() == null
                || !analysis.timeManagement().recommendations().isEmpty()) {
            throw new InvalidAIAnalysisException("timeManagement phải phản ánh dữ liệu không đủ");
        }
        if (analysis.studyPlan().size() != 7) {
            throw new InvalidAIAnalysisException("studyPlan phải có đúng 7 ngày");
        }
        if (analysis.partAnalysis().size() != 7) {
            throw new InvalidAIAnalysisException("partAnalysis phải có đúng 7 Part");
        }
        if (analysis.priorityTopics().size() != 3) {
            throw new InvalidAIAnalysisException("priorityTopics phải có đúng 3 mục");
        }
        if (!Set.of("LOW", "MEDIUM", "HIGH").contains(analysis.overallConfidence())) {
            throw new InvalidAIAnalysisException("overallConfidence không hợp lệ");
        }
        validateLocalizedContent(analysis, locale);

        Set<Integer> validQuestions = new HashSet<>();
        Set<String> validTags = new HashSet<>();
        for (ReviewQuestion question : input.questions()) {
            validQuestions.add(question.questionNumber());
            validTags.add(question.questionType());
            validTags.add(question.difficulty());
            validTags.addAll(question.skillTags());
            validTags.addAll(question.grammarTags());
        }
        for (GeminiAnalysis.Strength strength : analysis.strengths()) {
            validateEvidence(strength.evidence(), strength.confidence(), strength.tag(),
                    strength.part(), input, statistics, validQuestions);
            validateTag(strength.tag(), validTags);
        }
        for (GeminiAnalysis.Weakness weakness : analysis.weaknesses()) {
            validateEvidence(weakness.evidence(), weakness.confidence(), weakness.tag(),
                    weakness.part(), input, statistics, validQuestions);
            validateTag(weakness.tag(), validTags);
        }
        Set<Integer> analyzedParts = new HashSet<>();
        for (GeminiAnalysis.PartAnalysis part : analysis.partAnalysis()) {
            if (part.part() < 1 || part.part() > 7 || !analyzedParts.add(part.part())) {
                throw new InvalidAIAnalysisException("Part không hợp lệ");
            }
            ReviewStatistics.Metric metric = statistics.byPart().get(String.valueOf(part.part()));
            if (metric == null || !sameAccuracy(part.accuracy(), metric.accuracy())) {
                throw new InvalidAIAnalysisException("Gemini đã thay đổi độ chính xác Part " + part.part());
            }
            validateTags(part.strongTags(), validTags);
            validateTags(part.weakTags(), validTags);
        }
        for (GeminiAnalysis.KnowledgeGap gap : analysis.knowledgeGaps()) {
            validateTag(gap.tag(), validTags);
            ReviewStatistics.Metric metric = metricFor(gap.tag(), null, statistics);
            if (metric == null || !sameAccuracy(gap.currentAccuracy(), metric.accuracy())) {
                throw new InvalidAIAnalysisException("Gemini đã thay đổi độ chính xác knowledge gap");
            }
        }
        for (GeminiAnalysis.PriorityTopic topic : analysis.priorityTopics()) {
            validateTag(topic.tag(), validTags);
        }
        for (GeminiAnalysis.NextAction action : analysis.nextActions()) {
            validateQuestionNumbers(action.questionNumbers(), validQuestions);
            validateTag(action.tag(), validTags);
        }
        Set<Integer> studyDays = new HashSet<>();
        for (GeminiAnalysis.StudyDay day : analysis.studyPlan()) {
            if (day.day() < 1 || day.day() > 7 || !studyDays.add(day.day()) || day.tasks() == null) {
                throw new InvalidAIAnalysisException("Ngày trong studyPlan không hợp lệ");
            }
            for (GeminiAnalysis.StudyTask task : day.tasks()) {
                validateTag(task.skillTag(), validTags);
            }
        }
    }

    private void validateLocalizedContent(GeminiAnalysis analysis, String locale) {
        requireLanguage(analysis.summary().headline(), "summary.headline", 3, locale);
        requireLanguage(analysis.summary().overallComment(), "summary.overallComment", 25, locale);

        for (GeminiAnalysis.Strength item : analysis.strengths()) {
            requireLanguage(item.title(), "strength.title", 2, locale);
            requireLanguage(item.message(), "strength.message", 15, locale);
        }
        for (GeminiAnalysis.Weakness item : analysis.weaknesses()) {
            requireLanguage(item.title(), "weakness.title", 2, locale);
            requireLanguage(item.message(), "weakness.message", 15, locale);
            requireLanguage(item.recommendation(), "weakness.recommendation", 12, locale);
        }
        for (GeminiAnalysis.PartAnalysis item : analysis.partAnalysis()) {
            requireLanguage(item.summary(), "partAnalysis[" + item.part() + "].summary", 18, locale);
        }
        for (GeminiAnalysis.KnowledgeGap item : analysis.knowledgeGaps()) {
            requireLanguage(item.name(), "knowledgeGap.name", 2, locale);
            requireLanguage(item.explanation(), "knowledgeGap.explanation", 12, locale);
            requireList(item.topicsToReview(), "knowledgeGap.topicsToReview");
            for (String topic : item.topicsToReview()) {
                requireLanguage(topic, "knowledgeGap.topicsToReview", 2, locale);
            }
        }
        requireLanguage(analysis.timeManagement().summary(), "timeManagement.summary", 5, locale);
        for (GeminiAnalysis.PriorityTopic item : analysis.priorityTopics()) {
            requireLanguage(item.title(), "priorityTopic.title", 2, locale);
            requireLanguage(item.reason(), "priorityTopic.reason", 12, locale);
            requireLanguage(item.goal(), "priorityTopic.goal", 5, locale);
        }
        for (GeminiAnalysis.StudyDay day : analysis.studyPlan()) {
            requireLanguage(day.title(), "studyPlan.title", 2, locale);
            requireList(day.tasks(), "studyPlan.tasks");
            for (GeminiAnalysis.StudyTask task : day.tasks()) {
                requireLanguage(task.title(), "studyPlan.task.title", 3, locale);
            }
        }
        for (GeminiAnalysis.NextAction action : analysis.nextActions()) {
            requireLanguage(action.label(), "nextAction.label", 2, locale);
        }
        for (String limitation : analysis.limitations()) {
            requireLanguage(limitation, "limitations", 5, locale);
        }
    }

    private void requireLanguage(String value, String field, int minimumWords, String locale) {
        boolean valid = "en".equals(locale)
                ? isAcceptableEnglishText(value, minimumWords)
                : isAcceptableVietnameseText(value, minimumWords);
        if (!valid) {
            throw new InvalidAIAnalysisException(
                    field + " phải dùng đúng ngôn ngữ " + locale
                            + " và đủ chi tiết (tối thiểu " + minimumWords + " từ)"
            );
        }
    }

    static boolean isAcceptableVietnameseText(String value, int minimumWords) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.split("\\s+").length < minimumWords
                || !VIETNAMESE_MARKER.matcher(normalized).find()) {
            return false;
        }
        Matcher englishWords = ENGLISH_COMMON_WORD.matcher(normalized);
        int englishWordCount = 0;
        while (englishWords.find()) {
            englishWordCount++;
            if (englishWordCount >= 3) {
                return false;
            }
        }
        return true;
    }

    static boolean isAcceptableEnglishText(String value, int minimumWords) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.split("\\s+").length < minimumWords
                || !ENGLISH_MARKER.matcher(normalized).find()) {
            return false;
        }
        Matcher vietnameseWords = VIETNAMESE_MARKER.matcher(normalized);
        int vietnameseWordCount = 0;
        while (vietnameseWords.find()) {
            vietnameseWordCount++;
            if (vietnameseWordCount >= 3) {
                return false;
            }
        }
        return true;
    }

    private void validateEvidence(
            GeminiAnalysis.Evidence evidence,
            String confidence,
            String tag,
            Integer part,
            ReviewInput input,
            ReviewStatistics statistics,
            Set<Integer> validQuestions
    ) {
        if (evidence == null || evidence.total() < 0 || evidence.correct() < 0
                || evidence.correct() > evidence.total()) {
            throw new InvalidAIAnalysisException("Evidence không hợp lệ");
        }
        validateQuestionNumbers(evidence.questionNumbers(), validQuestions);
        validateQuestionNumbers(evidence.wrongQuestionNumbers(), validQuestions);
        ReviewStatistics.Metric metric = metricFor(tag, part, statistics);
        if (metric == null || evidence.total() != metric.sampleSize()
                || evidence.correct() != metric.correct()
                || !sameAccuracy(evidence.accuracy(), metric.accuracy())) {
            throw new InvalidAIAnalysisException("Evidence không khớp thống kê đã tính");
        }
        validateEvidenceQuestions(evidence.questionNumbers(), tag, part, input, false);
        validateEvidenceQuestions(evidence.wrongQuestionNumbers(), tag, part, input, true);
        if (evidence.total() < 3 && !"LOW".equals(confidence)) {
            throw new InvalidAIAnalysisException("sampleSize dưới 3 phải có confidence LOW");
        }
    }

    private ReviewStatistics.Metric metricFor(
            String tag,
            Integer part,
            ReviewStatistics statistics
    ) {
        if (tag != null && !tag.isBlank()) {
            for (Map<String, ReviewStatistics.Metric> metrics : List.of(
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

    private void validateEvidenceQuestions(
            List<Integer> numbers,
            String tag,
            Integer part,
            ReviewInput input,
            boolean requireWrong
    ) {
        if (numbers == null) {
            return;
        }
        Map<Integer, ReviewQuestion> questions = input.questions().stream().collect(
                java.util.stream.Collectors.toMap(ReviewQuestion::questionNumber, question -> question)
        );
        for (Integer number : numbers) {
            ReviewQuestion question = questions.get(number);
            boolean tagMatches = tag == null || tag.isBlank()
                    || tag.equals(question.questionType())
                    || tag.equals(question.difficulty())
                    || question.skillTags().contains(tag)
                    || question.grammarTags().contains(tag);
            boolean partMatches = part == null || part == question.partNumber();
            boolean wrongMatches = !requireWrong || (!question.correct() && !question.unanswered());
            if (!tagMatches || !partMatches || !wrongMatches) {
                throw new InvalidAIAnalysisException("Question number trong evidence không khớp dữ liệu");
            }
        }
    }

    private void validateTags(List<String> tags, Set<String> validTags) {
        if (tags == null) {
            throw new InvalidAIAnalysisException("Danh sách tag bị thiếu");
        }
        tags.forEach(tag -> validateTag(tag, validTags));
    }

    private boolean sameAccuracy(double first, double second) {
        return Math.abs(first - second) < 0.01;
    }

    private void validateQuestionNumbers(List<Integer> numbers, Set<Integer> validQuestions) {
        if (numbers == null) {
            return;
        }
        if (numbers.stream().anyMatch(number -> number == null || !validQuestions.contains(number))) {
            throw new InvalidAIAnalysisException("Gemini tạo questionNumber không có trong input");
        }
    }

    private void validateTag(String tag, Set<String> validTags) {
        if (tag != null && !tag.isBlank() && !validTags.contains(tag)) {
            throw new InvalidAIAnalysisException("Gemini tạo tag không có trong input: " + tag);
        }
    }

    private void requireList(List<?> value, String field) {
        if (value == null) {
            throw new InvalidAIAnalysisException("Thiếu " + field);
        }
    }

    public static class InvalidAIAnalysisException extends RuntimeException {
        public InvalidAIAnalysisException(String message) {
            super(message);
        }
    }
}
