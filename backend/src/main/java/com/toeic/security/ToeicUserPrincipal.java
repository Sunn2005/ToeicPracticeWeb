package com.toeic.security;

import com.toeic.model.User;
import com.toeic.model.enums.UserRole;

public record ToeicUserPrincipal(
        String uid,
        String email,
        String displayName,
        String photoUrl,
        UserRole role,
        Long createdAt,
        Long lastLoginAt
) {

    public static ToeicUserPrincipal from(User user) {
        UserRole role = user.getRole() == null ? UserRole.USER : user.getRole();
        return new ToeicUserPrincipal(
                user.getUid(),
                user.getEmail(),
                user.getDisplayName(),
                user.getPhotoUrl(),
                role,
                user.getCreatedAt(),
                user.getLastLoginAt()
        );
    }

    public User toUser() {
        return new User(
                uid,
                email,
                displayName,
                photoUrl,
                role,
                createdAt,
                lastLoginAt
        );
    }
}
