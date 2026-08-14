package com.toeic.service;

import com.toeic.dao.TestDao;
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

@Service
public class TestService {

    private final TestDao testDao;
    private final ObjectMapper objectMapper;

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

    public Map<String, Object> getExamTest(String testId) throws Exception {
        return toResponse(loadTest(testId), true);
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
        return toResponse(loadTest(testId), false);
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

    private Test loadTest(String testId) throws Exception {
        Test test = requireMetadata(testId);
        List<TestPart> parts = new ArrayList<>();

        for (int partNumber = 1; partNumber <= 7; partNumber++) {
            int currentPart = partNumber;
            TestPart part = testDao.findPart(testId, partNumber).orElseThrow(
                    () -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Đề thi thiếu dữ liệu Part " + currentPart
                    )
            );
            parts.add(part);
        }

        test.setParts(parts);
        return test;
    }

    private Test requireMetadata(String testId) throws Exception {
        Test test = testDao.findMetadataById(testId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi")
        );
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
            map.remove("explanation");
            map.remove("transcript");
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
}
