package com.toeic.model;

public record FirebaseIdentity(
        String uid,
        String email,
        String displayName,
        String photoUrl,
        String claimedRole,
        Long authenticatedAtEpochSeconds
) {
    public FirebaseIdentity(String uid, String email, String displayName, String photoUrl, String claimedRole) {
        this(uid, email, displayName, photoUrl, claimedRole, null);
    }
}
