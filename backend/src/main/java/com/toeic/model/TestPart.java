package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class TestPart {

    private Integer partNumber;
    private String name;
    private List<Question> questions;
    private List<QuestionGroup> groups;
    private List<Passage> passages;
    private List<PassageGroup> passageGroups;

    public List<Question> allQuestions() {
        List<Question> result = new ArrayList<>();
        addQuestions(result, questions);
        if (groups != null) {
            for (QuestionGroup group : groups) {
                addQuestions(result, group.getQuestions());
            }
        }
        if (passages != null) {
            for (Passage passage : passages) {
                addQuestions(result, passage.getQuestions());
            }
        }
        if (passageGroups != null) {
            for (PassageGroup group : passageGroups) {
                addQuestions(result, group.getQuestions());
                if (group.getPassages() != null) {
                    for (Passage passage : group.getPassages()) {
                        addQuestions(result, passage.getQuestions());
                    }
                }
            }
        }
        return result;
    }

    private void addQuestions(List<Question> target, List<Question> source) {
        if (source != null) {
            target.addAll(source);
        }
    }
}
