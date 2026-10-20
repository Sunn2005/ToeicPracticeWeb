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
        User user = new User();
        user.setUid(uid);
        user.setEmail(email);
        user.setDisplayName(displayName);
        user.setPhotoUrl(photoUrl);
        user.setRole(role);
        user.setCreatedAt(createdAt);
        user.setLastLoginAt(lastLoginAt);
        return user;
    }
}
