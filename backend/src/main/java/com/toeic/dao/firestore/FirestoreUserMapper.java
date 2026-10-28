package com.toeic.dao.firestore;

import com.google.cloud.Timestamp;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;

import java.util.Date;
import java.util.Map;

/** Reads existing profiles without requiring a Firestore data migration. */
final class FirestoreUserMapper {
    private FirestoreUserMapper() {}

    static User from(String uid, Map<String, Object> data) {
        User user = new User();
        user.setUid(uid);
        user.setEmail((String) data.get("email"));
        user.setDisplayName((String) data.get("displayName"));
        user.setPhotoUrl((String) data.get("photoUrl"));
        Number targetScore = (Number) data.get("targetScore");
        user.setTargetScore(targetScore == null ? null : Math.toIntExact(targetScore.longValue()));
        user.setPhoneNumber((String) data.get("phoneNumber"));
        user.setDateOfBirth((String) data.get("dateOfBirth"));
        user.setGender((String) data.get("gender"));
        Object role = data.get("role");
        user.setRole(role == null ? null : role instanceof UserRole typed ? typed : UserRole.valueOf((String) role));
        user.setStaffGroupId((String) data.get("staffGroupId"));
        user.setStaffActive((Boolean) data.get("staffActive"));
        user.setStaffNotes((String) data.get("staffNotes"));
        Number staffVersion = (Number) data.get("staffVersion");
        user.setStaffVersion(staffVersion == null ? null : staffVersion.longValue());
        user.setCredentialsChangedAt(data.get("credentialsChangedAt") instanceof Number value ? value.longValue() : null);
        user.setCredentialVersion(data.get("credentialVersion") instanceof Number value ? value.longValue() : null);
        user.setStaffProvisioned((Boolean) data.get("staffProvisioned"));
        user.setPasswordChangeRequired((Boolean) data.get("passwordChangeRequired"));
        user.setTemporaryPasswordExpiresAt(data.get("temporaryPasswordExpiresAt") instanceof Number value ? value.longValue() : null);
        user.setCredentialEmailStatus((String) data.get("credentialEmailStatus"));
        user.setCredentialLastSentAt(data.get("credentialLastSentAt") instanceof Number value ? value.longValue() : null);
        user.setCredentialOperation((String) data.get("credentialOperation"));
        user.setStaffResetTokenHash((String) data.get("staffResetTokenHash"));
        user.setStaffResetExpiresAt(data.get("staffResetExpiresAt") instanceof Number value ? value.longValue() : null);
        user.setStaffResetRequestedAt(data.get("staffResetRequestedAt") instanceof Number value ? value.longValue() : null);
        user.setCreatedAt(epochMillis(data.get("createdAt"), "createdAt"));
        user.setLastLoginAt(epochMillis(data.get("lastLoginAt"), "lastLoginAt"));
        return user;
    }

    private static Long epochMillis(Object value, String field) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        if (value instanceof Timestamp timestamp) {
            return timestamp.getSeconds() * 1_000L + timestamp.getNanos() / 1_000_000L;
        }
        if (value instanceof Date date) return date.getTime();
        throw new IllegalArgumentException("Kiểu dữ liệu Firestore không hợp lệ cho " + field + ": " + value.getClass().getName());
    }
}
