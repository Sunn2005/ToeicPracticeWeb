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
    private String questionTranslation;
    private String answerTranslation;
    private String detailedExplanation;

    /**
     * Legacy field kept only so existing Firestore documents can still be read.
     * API responses expose {@code questionTranslation} instead.
     */
    @Deprecated
    private String translation;

    /**
     * Legacy field kept only so existing Firestore documents can still be read.
     * API responses expose {@code detailedExplanation} instead.
     */
    @Deprecated
    private String explanation;
    private String transcript;
    private String grammarTopic;
}
