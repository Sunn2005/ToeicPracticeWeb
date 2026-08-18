package com.toeic.service;

import com.toeic.dao.TestDao;
import com.toeic.model.Question;
import com.toeic.model.Test;
import com.toeic.model.TestPart;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class TestManagementSupport {

    private final TestDao testDao;
    private final ObjectMapper objectMapper;

    public TestManagementSupport(TestDao testDao, ObjectMapper objectMapper) {
        this.testDao = testDao;
        this.objectMapper = objectMapper;
    }

    public Test requireMetadata(String testId) throws Exception {
        return testDao.findMetadataById(testId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đề thi")
        );
    }

    public Test loadFullTest(String testId) throws Exception {
        Test test = requireMetadata(testId);
        List<TestPart> parts = new ArrayList<>();
        for (int partNumber = 1; partNumber <= 7; partNumber++) {
            testDao.findPart(testId, partNumber).ifPresent(parts::add);
        }
        test.setParts(parts);
        return test;
    }

    public Map<String, Object> toMap(Test test, boolean includeParts) {
        Map<String, Object> response = objectMapper.convertValue(
                test,
                new TypeReference<Map<String, Object>>() {
                }
        );
        if (!includeParts) {
            response.remove("parts");
        }
        return response;
    }

    public void validateDraftMetadata(Test test) {
        if (test.getTitle() == null || test.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên đề thi không được để trống");
        }
    }

    public void validateForSubmission(Test test) {
        validateDraftMetadata(test);
        if (test.getParts() == null || test.getParts().size() != 7) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đề phải có đủ Part 1 đến Part 7");
        }

        Set<Integer> partNumbers = new HashSet<>();
        Map<Integer, Question> questions = new LinkedHashMap<>();
        for (TestPart part : test.getParts()) {
            if (part.getPartNumber() == null || !partNumbers.add(part.getPartNumber())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Part bị thiếu hoặc trùng partNumber");
            }
            for (Question question : part.allQuestions()) {
                Integer number = question.getQuestionNumber();
                if (number == null || questions.put(number, question) != null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Câu hỏi bị thiếu hoặc trùng questionNumber");
                }
            }
        }

        if (!partNumbers.equals(Set.of(1, 2, 3, 4, 5, 6, 7))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đề phải có đúng Part 1 đến Part 7");
        }
        if (questions.size() != 200 || !questions.keySet().equals(expectedQuestionNumbers())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đề phải có đúng 200 câu, đánh số từ 1 đến 200");
        }
        for (Question question : questions.values()) {
            if (question.getCorrectAnswer() == null
                    || !Set.of("A", "B", "C", "D").contains(question.getCorrectAnswer().toUpperCase())) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Mỗi câu phải có correctAnswer là A, B, C hoặc D"
                );
            }
            if (question.getAnswers() == null || question.getAnswers().size() != 4) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mỗi câu phải có đúng 4 đáp án");
            }
        }
    }

    private Set<Integer> expectedQuestionNumbers() {
        Set<Integer> numbers = new HashSet<>();
        for (int number = 1; number <= 200; number++) {
            numbers.add(number);
        }
        return numbers;
    }
}
