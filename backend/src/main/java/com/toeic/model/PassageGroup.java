package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class PassageGroup {

    private Integer groupNumber;
    private String questionRange;
    private String passageType;
    private List<String> imageUrls;
    private List<Passage> passages;
    private List<Question> questions;
}
