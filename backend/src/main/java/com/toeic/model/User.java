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
    private Long credentialsChangedAt;
    private Long credentialVersion;
    private Boolean staffProvisioned;
    private Boolean passwordChangeRequired;
    private Long temporaryPasswordExpiresAt;
    private String credentialEmailStatus;
    private Long credentialLastSentAt;
    private String credentialOperation;
    private String staffResetTokenHash;
    private Long staffResetExpiresAt;
    private Long staffResetRequestedAt;
    private Long createdAt;
    private Long lastLoginAt;
}
