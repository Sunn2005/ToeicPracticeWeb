package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class Question {

    private Integer questionNumber;
    private String imageUrl;
    private String audioUrl;
    private String question;
    private List<AnswerOption> answers;
    private String correctAnswer;
    private String translation;
    private String explanation;
    private String transcript;
    private String grammarTopic;
}
