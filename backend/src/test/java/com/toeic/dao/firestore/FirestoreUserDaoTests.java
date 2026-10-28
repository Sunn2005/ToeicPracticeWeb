package com.toeic.dao.firestore;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.*;
import com.toeic.model.User;
import com.toeic.model.enums.UserRole;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FirestoreUserDaoTests {
    @SuppressWarnings("unchecked")
    @Test void savingStaleProfileCannotRestoreRolesOrCredentialState() throws Exception {
        Firestore db = mock(Firestore.class); CollectionReference users = mock(CollectionReference.class);
        DocumentReference ref = mock(DocumentReference.class); DocumentSnapshot snapshot = mock(DocumentSnapshot.class);
        Transaction tx = mock(Transaction.class);
        when(db.collection("users")).thenReturn(users); when(users.document("staff")).thenReturn(ref);
        when(tx.get(ref)).thenReturn(ApiFutures.immediateFuture(snapshot)); when(snapshot.exists()).thenReturn(true); when(snapshot.get("role")).thenReturn("EMPLOYEE");
        when(db.runTransaction(any(Transaction.Function.class))).thenAnswer(call -> {
            Transaction.Function<Object> action = call.getArgument(0); return ApiFutures.immediateFuture(action.updateCallback(tx));
        });
        User stale = new User(); stale.setUid("staff"); stale.setRole(UserRole.ADMIN); stale.setDisplayName("Updated profile");
        stale.setPasswordChangeRequired(false); stale.setStaffResetTokenHash("stale-token"); stale.setStaffGroupId("admin");
        stale.setCredentialsChangedAt(0L); stale.setCredentialVersion(0L);
        new FirestoreUserDao(db).save(stale);
        ArgumentCaptor<Map<String, Object>> saved = ArgumentCaptor.forClass(Map.class);
        verify(tx).update(eq(ref), saved.capture()); assertEquals("Updated profile", saved.getValue().get("displayName"));
        for (String key : new String[]{"role", "staffGroupId", "passwordChangeRequired", "staffResetTokenHash", "credentialsChangedAt", "credentialVersion", "credentialOperation"}) {
            assertFalse(saved.getValue().containsKey(key), key);
        }
        verify(tx, never()).set(any(DocumentReference.class), any());
        verify(tx, never()).create(any(DocumentReference.class), any());
    }
}
