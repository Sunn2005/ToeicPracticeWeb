package com.toeic.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import com.toeic.model.enums.UserRole;

@NoArgsConstructor
@Data
public class User {
    private String uid;
    private String email;
    private String displayName;
    private String photoUrl;
    private Integer targetScore;
    private String phoneNumber;
    private String dateOfBirth;
    private String gender;
    private UserRole role;
    private String staffGroupId;
    private Boolean staffActive;
    private String staffNotes;
    private Long staffVersion;
    private Long createdAt;
    private Long lastLoginAt;
}
