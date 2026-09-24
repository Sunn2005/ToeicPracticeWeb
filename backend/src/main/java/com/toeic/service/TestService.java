package com.toeic.service;

import com.toeic.dao.TestDao;
import com.toeic.model.Passage;
import com.toeic.model.PassageGroup;
import com.toeic.model.Question;
import com.toeic.model.QuestionGroup;
import com.toeic.model.Test;
import com.toeic.model.TestPart;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import com.toeic.model.enums.TestStatus;

@Service
public class TestService {

    private static final List<Integer> ALL_PARTS = List.of(1, 2, 3, 4, 5, 6, 7);

    private final TestDao testDao;
    private final ObjectMapper objectMapper;
    private final Map<String, Map<String, Object>> responseCache = new ConcurrentHashMap<>();

    public TestService(TestDao testDao, ObjectMapper objectMapper) {
        this.testDao = testDao;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> getMetadata(String testId) throws Exception {
        Test test = requireMetadata(testId);
        Map<String, Object> response = toMap(test);
        response.remove("parts");
        return response;
    }

    public List<Map<String, Object>> listPublishedTests() throws Exception {
        return testDao.findAllMetadata().stream()
                .filter(test -> test.getStatus() == null || test.getStatus() == TestStatus.APPROVED)
                .sorted(Comparator.comparing(
                        Test::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(test -> {
                    Map<String, Object> metadata = toMap(test);
                    metadata.remove("parts");
                    if (metadata.get("status") == null) {
                        metadata.put("status", TestStatus.APPROVED.name());
                    }
                    return metadata;
                })
                .toList();
    }

    public Map<String, Object> getExamTest(String testId) throws Exception {
        return getExamTest(testId, null);
    }

    public Map<String, Object> getExamTest(String testId, List<Integer> partNumbers) throws Exception {
        return cachedResponse("exam", loadTest(testId, partNumbers), true);
    }

    public Map<String, Object> getExamPart(String testId, int partNumber) throws Exception {
        requireMetadata(testId);
        TestPart part = testDao.findPart(testId, partNumber).orElseThrow(
                () -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy Part " + partNumber
                )
        );
        Map<String, Object> response = objectMapper.convertValue(
                part,
                new TypeReference<Map<String, Object>>() {
                }
        );
        removeExamSecrets(response);
        if (partNumber <= 2) {
            removeListeningOptionText(response);
        }
        return response;
    }

    public Map<String, Object> getReviewTest(String testId) throws Exception {
        return getReviewTest(testId, null);
    }

    public Map<String, Object> getReviewTest(String testId, List<Integer> partNumbers) throws Exception {
        return cachedResponse("review", loadTest(testId, partNumbers), false);
    }

    public Map<Integer, String> getAnswerKey(String testId) throws Exception {
        return loadTest(testId).answerKey();
    }

    public Map<String, Object> addReviewAnswers(
            Map<String, Object> fullTest,
            Map<Integer, String> selectedAnswers
    ) {
        Object annotated = annotateReview(fullTest, selectedAnswers);
        return castMap(annotated);
    }

    /**
     * Returns answer feedback for exactly one practice unit. A unit is a
     * standalone question or the complete group attached to one audio clip or
     * passage. Secrets are released only after every question in that unit has
     * an answer.
     */
    public Map<String, Object> getPracticeFeedback(
            String testId,
            int questionNumber,
            Map<Integer, String> selectedAnswers
    ) throws Exception {
        requireMetadata(testId);
        int partNumber = partNumberForQuestion(questionNumber);
        TestPart part = testDao.findPart(testId, partNumber).orElseThrow(
                () -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy Part " + partNumber
                )
        );
        PracticeUnit practiceUnit = findPracticeUnit(part, questionNumber);
        if (practiceUnit == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy nhóm câu hỏi");
        }

        List<Integer> questionNumbers = practiceUnit.questions().stream()
                .map(Question::getQuestionNumber)
                .toList();
        List<Integer> pendingQuestionNumbers = questionNumbers.stream()
                .filter(number -> selectedAnswers.get(number) == null)
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ready", pendingQuestionNumbers.isEmpty());
        response.put("partNumber", practiceUnit.partNumber());
        response.put("questionNumbers", questionNumbers);
        response.put("pendingQuestionNumbers", pendingQuestionNumbers);
        if (!pendingQuestionNumbers.isEmpty()) {
            return response;
        }

        List<Map<String, Object>> questions = practiceUnit.questions().stream()
                .map(question -> objectMapper.convertValue(
                        question,
                        new TypeReference<Map<String, Object>>() {
                        }
                ))
                .toList();
        Map<String, Object> feedback = new LinkedHashMap<>();
        feedback.put("questions", questions);
        ReviewFieldNormalizer.normalize(feedback);
        response.put("questions", addReviewAnswers(feedback, selectedAnswers).get("questions"));
        response.put("transcript", practiceUnit.transcript());
        response.put("transcriptTranslation", practiceUnit.transcriptTranslation());
        return response;
    }

    private Test loadTest(String testId) throws Exception {
        return loadTest(testId, null);
    }

    private Test loadTest(String testId, List<Integer> partNumbers) throws Exception {
        Test test = requireMetadata(testId);
        List<Integer> requestedParts = normalizePartNumbers(partNumbers);
        List<TestPart> parts = testDao.findParts(testId, requestedParts);
        Set<Integer> found = parts.stream()
                .map(TestPart::getPartNumber)
                .collect(Collectors.toSet());
        for (int partNumber : requestedParts) {
            if (!found.contains(partNumber)) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Đề thi thiếu dữ liệu Part " + partNumber
                );
            }
        }
        test.setParts(parts);
        return test;
    }

    private List<Integer> normalizePartNumbers(List<Integer> partNumbers) {
        if (partNumbers == null || partNumbers.isEmpty()) {
            return ALL_PARTS;
        }
        return partNumbers.stream().distinct().sorted().toList();
    }

    private Map<String, Object> cachedResponse(String kind, Test test, boolean examSafe) {
        String partsKey = test.getParts() == null
                ? ""
                : test.getParts().stream()
                .map(part -> String.valueOf(part.getPartNumber()))
                .collect(Collectors.joining(","));
        String key = kind + ":" + test.getTestId() + ":" + test.getUpdatedAt() + ":" + partsKey;
        Map<String, Object> cached = responseCache.get(key);
        if (cached != null) {
            return cached;
        }
        Map<String, Object> built = toResponse(test, examSafe);
        responseCache.put(key, built);
        return built;
    }

    private PracticeUnit findPracticeUnit(TestPart part, int questionNumber) {
        if (part.getQuestions() != null) {
            for (Question question : part.getQuestions()) {
                if (questionNumber == question.getQuestionNumber()) {
                    return new PracticeUnit(
                            part.getPartNumber(),
                            List.of(question),
                            question.getTranscript(),
                            null
                    );
                }
            }
        }

        if (part.getGroups() != null) {
            for (QuestionGroup group : part.getGroups()) {
                if (containsQuestion(group.getQuestions(), questionNumber)) {
                    return new PracticeUnit(
                            part.getPartNumber(),
                            group.getQuestions(),
                            group.getTranscript(),
                            group.getTranscriptTranslation()
                    );
                }
            }
        }

        if (part.getPassages() != null) {
            for (Passage passage : part.getPassages()) {
                if (containsQuestion(passage.getQuestions(), questionNumber)) {
                    return new PracticeUnit(
                            part.getPartNumber(),
                            passage.getQuestions(),
                            null,
                            null
                    );
                }
            }
        }

        if (part.getPassageGroups() != null) {
            for (PassageGroup group : part.getPassageGroups()) {
                List<Question> questions = passageGroupQuestions(group);
                if (containsQuestion(questions, questionNumber)) {
                    return new PracticeUnit(
                            part.getPartNumber(),
                            questions,
                            null,
                            null
                    );
                }
            }
        }
        return null;
    }

    private int partNumberForQuestion(int questionNumber) {
        if (questionNumber <= 6) return 1;
        if (questionNumber <= 31) return 2;
        if (questionNumber <= 70) return 3;
        if (questionNumber <= 100) return 4;
        if (questionNumber <= 130) return 5;
        if (questionNumber <= 146) return 6;
        return 7;
    }

    private boolean containsQuestion(List<Question> questions, int questionNumber) {
        return questions != null && questions.stream()
                .anyMatch(question -> question.getQuestionNumber() == questionNumber);
    }

    private List<Question> passageGroupQuestions(PassageGroup group) {
        Map<Integer, Question> questions = new LinkedHashMap<>();
        addQuestionsByNumber(questions, group.getQuestions());
        if (group.getPassages() != null) {
            for (Passage passage : group.getPassages()) {
                addQuestionsByNumber(questions, passage.getQuestions());
            }
        }
        return new ArrayList<>(questions.values());
    }

    private void addQuestionsByNumber(Map<Integer, Question> target, List<Question> source) {
        if (source == null) {
            return;
        }
        for (Question question : source) {
            if (question.getQuestionNumber() != null) {
                target.putIfAbsent(question.getQuestionNumber(), question);
            }
        }
    }

    private Test requireMetadata(String testId) throws Exception {
        Test test = testDao.findMetadataById(testId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi")
        );
        if (test.getStatus() != null && test.getStatus() != TestStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi");
        }
        test.setTestId(testId);
        if (test.getType() == null) {
            test.setType("FULL_TEST");
        }
        if (test.getListeningMinutes() == null) {
            test.setListeningMinutes(45);
        }
        if (test.getReadingMinutes() == null) {
            test.setReadingMinutes(75);
        }
        if (test.getTotalMinutes() == null) {
            test.setTotalMinutes(120);
        }
        return test;
    }

    private Map<String, Object> toResponse(Test test, boolean examSafe) {
        Map<String, Object> response = toMap(test);
        ReviewFieldNormalizer.normalize(response);
        if (examSafe) {
            removeExamSecrets(response);
            Object partsValue = response.get("parts");
            if (partsValue instanceof List<?> parts) {
                for (Object value : parts) {
                    if (value instanceof Map<?, ?> part
                            && part.get("partNumber") instanceof Number number
                            && number.intValue() <= 2) {
                        removeListeningOptionText(part);
                    }
                }
            }
        }
        return response;
    }

    private Map<String, Object> toMap(Test test) {
        return objectMapper.convertValue(
                test,
                new TypeReference<Map<String, Object>>() {
                }
        );
    }

    private void removeExamSecrets(Object value) {
        if (value instanceof Map<?, ?> map) {
            map.remove("correctAnswer");
            map.remove("questionTranslation");
            map.remove("answerTranslation");
            map.remove("detailedExplanation");
            map.remove("translation");
            map.remove("explanation");
            map.remove("transcript");
            map.remove("transcriptTranslation");
            for (Object child : map.values()) {
                removeExamSecrets(child);
            }
        } else if (value instanceof List<?> list) {
            for (Object child : list) {
                removeExamSecrets(child);
            }
        }
    }

    private void removeListeningOptionText(Object value) {
        if (value instanceof Map<?, ?> map) {
            Object answers = map.get("answers");
            if (answers instanceof List<?> options) {
                for (Object option : options) {
                    if (option instanceof Map<?, ?> answer) {
                        answer.remove("content");
                    }
                }
            }
            for (Object child : map.values()) {
                removeListeningOptionText(child);
            }
        } else if (value instanceof List<?> list) {
            for (Object child : list) {
                removeListeningOptionText(child);
            }
        }
    }

    private Object annotateReview(Object value, Map<Integer, String> selectedAnswers) {
        if (value instanceof Map<?, ?> source) {
            Map<String, Object> copy = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : source.entrySet()) {
                copy.put(String.valueOf(entry.getKey()), annotateReview(entry.getValue(), selectedAnswers));
            }

            Object questionNumber = source.get("questionNumber");
            Object correctAnswer = source.get("correctAnswer");
            if (questionNumber instanceof Number number && correctAnswer instanceof String correct) {
                String selected = selectedAnswers.get(number.intValue());
                copy.put("selectedAnswer", selected);
                copy.put("answerStatus", selected == null
                        ? "UNANSWERED"
                        : correct.equalsIgnoreCase(selected) ? "CORRECT" : "INCORRECT");
            }
            return copy;
        }

        if (value instanceof List<?> source) {
            List<Object> copy = new ArrayList<>();
            for (Object item : source) {
                copy.add(annotateReview(item, selectedAnswers));
            }
            return copy;
        }

        return value;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }

    private record PracticeUnit(
            Integer partNumber,
            List<Question> questions,
            String transcript,
            String transcriptTranslation
    ) {
    }
}
