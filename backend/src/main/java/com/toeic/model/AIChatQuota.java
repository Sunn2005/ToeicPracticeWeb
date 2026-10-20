package com.toeic.model;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class AIChatQuota {
    private String userId;
    private String date;
    private Integer acceptedCount;
    private List<Long> acceptedTimestamps;
    private Long nextResetAt;
}
