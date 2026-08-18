package com.toeic.model;

public record FirebaseIdentity(
        String uid,
        String email,
        String displayName,
        String photoUrl,
        String claimedRole
) {
}
