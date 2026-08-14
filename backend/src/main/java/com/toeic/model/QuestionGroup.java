package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class QuestionGroup {

    private Integer groupNumber;
    private String questionRange;
    private String audioUrl;
    private String imageUrl;
    private String transcript;
    private List<Question> questions;
}
