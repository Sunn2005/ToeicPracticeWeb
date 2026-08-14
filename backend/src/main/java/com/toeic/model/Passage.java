package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class Passage {

    private Integer passageNumber;
    private String title;
    private String passageType;
    private String type;
    private String content;
    private String imageUrl;
    private List<Question> questions;
}
