package com.toeic.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
public class StaffGroup {
    private String id;
    private String name;
    private String code;
    private String description;
    private List<String> permissions = new ArrayList<>();
    private Long version = 0L;
}
