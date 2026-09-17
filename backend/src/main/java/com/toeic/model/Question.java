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
     * Source data can contain either the legacy translation string or the
     * current object with {@code question} and {@code answer} fields. API
     * responses normalize both representations to {@code questionTranslation}
     * and {@code answerTranslation}.
     */
    private Object translation;

    /**
     * Legacy field kept only so existing Firestore documents can still be read.
     * API responses expose {@code detailedExplanation} instead.
     */
    @Deprecated
    private String explanation;
    private String transcript;
    private String grammarTopic;
    private String questionType;
    private List<String> skillTags;
    private List<String> grammarTags;
    private String difficulty;
}
