package com.toeic.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.toeic.model.enums.UserRole;

@AllArgsConstructor
@NoArgsConstructor
@Data
public class User {
    private String uid;
    private String email;
    private String displayName;
    private String photoUrl;
    private UserRole role;
    private Long createdAt;
    private Long lastLoginAt;
}
