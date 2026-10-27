package com.toeic.dao.firestore;

import com.google.api.core.ApiFutures;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.*;
import com.toeic.model.enums.UserRole;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FirestoreUserMapperTests {
    @Test void readsNativeTimestampsWithoutMutatingStoredData() {
        Timestamp created = Timestamp.ofTimeSecondsAndNanos(1_700_000_000L, 123_456_789);
        Map<String, Object> data = Map.of("createdAt", created, "lastLoginAt", new Date(1_700_000_100_456L), "role", "EMPLOYEE");
        var user = FirestoreUserMapper.from("employee", data);
        assertEquals(1_700_000_000_123L, user.getCreatedAt());
        assertEquals(1_700_000_100_456L, user.getLastLoginAt());
        assertSame(created, data.get("createdAt"));
        assertEquals(UserRole.EMPLOYEE, user.getRole());
    }

    @Test void preservesNumericTimestampsAndAllProfileAndStaffFields() {
        Map<String, Object> data = Map.ofEntries(
                Map.entry("uid", "employee"), Map.entry("email", "employee@example.test"), Map.entry("displayName", "Employee"),
                Map.entry("photoUrl", "https://example.test/photo.png"), Map.entry("targetScore", 850L),
                Map.entry("phoneNumber", "0123456789"), Map.entry("dateOfBirth", "2000-01-01"), Map.entry("gender", "OTHER"),
                Map.entry("role", "EMPLOYEE"), Map.entry("staffGroupId", "creators"), Map.entry("staffActive", false),
                Map.entry("staffNotes", "Sample"), Map.entry("staffVersion", 3L),
                Map.entry("createdAt", 1_700_000_000_123L), Map.entry("lastLoginAt", 1_700_000_100_456L));
        var user = FirestoreUserMapper.from("employee", data);
        assertEquals("employee", user.getUid()); assertEquals("employee@example.test", user.getEmail());
        assertEquals("Employee", user.getDisplayName()); assertEquals(data.get("photoUrl"), user.getPhotoUrl());
        assertEquals(850, user.getTargetScore()); assertEquals("0123456789", user.getPhoneNumber());
        assertEquals("2000-01-01", user.getDateOfBirth()); assertEquals("OTHER", user.getGender());
        assertEquals(UserRole.EMPLOYEE, user.getRole()); assertEquals("creators", user.getStaffGroupId());
        assertEquals(false, user.getStaffActive()); assertEquals("Sample", user.getStaffNotes()); assertEquals(3L, user.getStaffVersion());
        assertEquals(data.get("createdAt"), user.getCreatedAt()); assertEquals(data.get("lastLoginAt"), user.getLastLoginAt());
    }

    @Test void missingDatesStayNullAndInvalidRolesAreNotElevated() {
        var user = FirestoreUserMapper.from("legacy", new HashMap<>());
        assertNull(user.getCreatedAt()); assertNull(user.getLastLoginAt()); assertNull(user.getRole());
        assertNull(user.getStaffActive()); assertNull(user.getStaffGroupId());
        assertThrows(IllegalArgumentException.class, () -> FirestoreUserMapper.from("legacy", Map.of("role", "SUPER_ADMIN")));
        assertThrows(IllegalArgumentException.class, () -> FirestoreUserMapper.from("legacy", Map.of("createdAt", "bad-date")));
    }

    @Test void profileLookupUsesSameTimestampCompatibleReader() throws Exception {
        Firestore db = mock(Firestore.class);
        CollectionReference users = mock(CollectionReference.class);
        DocumentReference reference = mock(DocumentReference.class);
        DocumentSnapshot snapshot = mock(DocumentSnapshot.class);
        when(db.collection("users")).thenReturn(users); when(users.document("employee")).thenReturn(reference);
        when(reference.get()).thenReturn(ApiFutures.immediateFuture(snapshot)); when(snapshot.exists()).thenReturn(true);
        when(snapshot.getData()).thenReturn(Map.of("createdAt", Timestamp.ofTimeSecondsAndNanos(1_700_000_000L, 123_000_000), "role", "EMPLOYEE"));
        var user = new FirestoreUserDao(db).findByUid("employee").orElseThrow();
        assertEquals(1_700_000_000_123L, user.getCreatedAt()); assertEquals("employee", user.getUid());
        verify(reference, never()).set(any(), any(SetOptions.class));
    }
}
