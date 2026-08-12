package com.toeic.dto;

import lombok.*;

import java.util.List;


@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class QuestionResponse {

    private int number;
    private String content;
    private List<OptionResponse> options;

}