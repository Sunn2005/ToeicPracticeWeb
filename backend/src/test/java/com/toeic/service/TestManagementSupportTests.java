package com.toeic.service;

import com.toeic.dao.TestDao;
import com.toeic.model.AnswerOption;
import com.toeic.model.Question;
import com.toeic.model.TestPart;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class TestManagementSupportTests {
    private final TestManagementSupport support = new TestManagementSupport(mock(TestDao.class), new ObjectMapper());

    private com.toeic.model.Test validTest() {
        com.toeic.model.Test test = new com.toeic.model.Test();
        test.setTitle("Employee test");
        List<TestPart> parts = new ArrayList<>();
        int[] counts = {6, 25, 39, 30, 30, 16, 54};
        int number = 1;
        for (int partNumber = 1; partNumber <= 7; partNumber++) {
            TestPart part = new TestPart();
            part.setPartNumber(partNumber);
            List<Question> questions = new ArrayList<>();
            for (int index = 0; index < counts[partNumber - 1]; index++) {
                Question question = new Question();
                question.setQuestionNumber(number++);
                question.setCorrectAnswer("A");
                question.setAnswers(new ArrayList<>(List.of(
                        new AnswerOption("A", "a"), new AnswerOption("B", "b"), new AnswerOption("C", "c"))));
                if (partNumber != 2) question.getAnswers().add(new AnswerOption("D", "d"));
                questions.add(question);
            }
            part.setQuestions(questions);
            parts.add(part);
        }
        test.setParts(parts);
        return test;
    }

    private void rejects(com.toeic.model.Test test) {
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
                () -> support.validateForSubmission(test)).getStatusCode());
    }

    @Test void acceptsThreeOptionsInPartTwoAndFourElsewhere() {
        assertDoesNotThrow(() -> support.validateForSubmission(validTest()));
    }

    @Test void rejectsFourOptionsInPartTwo() {
        var test = validTest();
        test.getParts().get(1).getQuestions().getFirst().getAnswers().add(new AnswerOption("D", "d"));
        rejects(test);
    }

    @Test void rejectsCorrectAnswerDInPartTwo() {
        var test = validTest();
        test.getParts().get(1).getQuestions().getFirst().setCorrectAnswer("D");
        rejects(test);
    }

    @Test void rejectsThreeOptionsOutsidePartTwo() {
        var test = validTest();
        test.getParts().getFirst().getQuestions().getFirst().getAnswers().removeLast();
        rejects(test);
    }

    @Test void rejectsDuplicateAndUnexpectedLabels() {
        for (String label : List.of("A", "D", "")) {
            var test = validTest();
            test.getParts().get(1).getQuestions().getFirst().getAnswers().get(2).setLabel(label);
            rejects(test);
        }
    }

    @Test void rejectsMissingAndDuplicateQuestionNumbersAndParts() {
        var missing = validTest();
        missing.getParts().getFirst().getQuestions().removeLast();
        rejects(missing);
        var duplicate = validTest();
        duplicate.getParts().getFirst().getQuestions().getFirst().setQuestionNumber(2);
        rejects(duplicate);
        var part = validTest();
        part.getParts().getFirst().setPartNumber(2);
        rejects(part);
    }
}
