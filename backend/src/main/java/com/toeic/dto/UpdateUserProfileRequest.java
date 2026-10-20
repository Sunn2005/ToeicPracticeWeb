package com.toeic.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateUserProfileRequest {
    private String displayName;
    private String photoUrl;
    private Integer targetScore;
    private String phoneNumber;
    private String dateOfBirth;
    private String gender;
}
