package com.toeic.service;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.*;
import com.toeic.controller.ApiCodeException;
import com.toeic.dao.firestore.FirestoreStaffStore;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FirestoreStaffStoreTests {
    @SuppressWarnings("unchecked")
    private FirestoreStaffStore setup(Firestore db, Transaction tx, DocumentReference lock, DocumentReference userRef) throws Exception {
        CollectionReference users = mock(CollectionReference.class), groups = mock(CollectionReference.class), management = mock(CollectionReference.class);
        when(db.collection("users")).thenReturn(users); when(db.collection("staffGroups")).thenReturn(groups); when(db.collection("staffManagement")).thenReturn(management);
        when(management.document("state")).thenReturn(lock); when(users.document("creator")).thenReturn(userRef);
        when(groups.document(anyString())).thenAnswer(call -> mock(DocumentReference.class));
        DocumentSnapshot marker = mock(DocumentSnapshot.class); when(tx.get(lock)).thenReturn(ApiFutures.immediateFuture(marker));
        QuerySnapshot userList = mock(QuerySnapshot.class), groupList = mock(QuerySnapshot.class);
        QueryDocumentSnapshot doc = mock(QueryDocumentSnapshot.class);
        when(doc.getData()).thenReturn(Map.of("role", "EMPLOYEE", "displayName", "Keep profile", "email", "creator@example.test",
                "createdAt", com.google.cloud.Timestamp.ofTimeSecondsAndNanos(1_700_000_000L, 123_000_000))); when(doc.getId()).thenReturn("creator"); when(userList.getDocuments()).thenReturn(List.of(doc)); when(groupList.getDocuments()).thenReturn(List.of());
        when(tx.get(users)).thenReturn(ApiFutures.immediateFuture(userList)); when(tx.get(groups)).thenReturn(ApiFutures.immediateFuture(groupList));
        when(db.runTransaction(any(Transaction.Function.class))).thenAnswer(call -> {
            Transaction.Function<Object> operation = call.getArgument(0);
            try { return ApiFutures.immediateFuture(operation.updateCallback(tx)); }
            catch (Exception failure) { return ApiFutures.immediateFailedFuture(failure); }
        });
        return new FirestoreStaffStore(db);
    }
    @Test void migrationOnlyUpdatesStaffFieldsAndUsesSharedTransactionLock() throws Exception {
        Firestore db = mock(Firestore.class); Transaction tx = mock(Transaction.class); DocumentReference lock = mock(DocumentReference.class), user = mock(DocumentReference.class);
        var store = setup(db, tx, lock, user);
        store.transact(state -> null);
        @SuppressWarnings("rawtypes") ArgumentCaptor<Map> fields = ArgumentCaptor.forClass(Map.class);
        verify(tx).get(lock); verify(tx).update(eq(user), fields.capture());
        assertEquals("creators", fields.getValue().get("staffGroupId")); assertEquals(true, fields.getValue().get("staffActive"));
        assertFalse(fields.getValue().containsKey("displayName")); assertFalse(fields.getValue().containsKey("email"));
        assertFalse(fields.getValue().containsKey("createdAt"));
        verify(tx).set(eq(lock), eq(Map.of("revision", 1L)));
    }
    @Test void businessFailureIsUnwrappedAndDoesNotQueueAnyWrites() throws Exception {
        Firestore db = mock(Firestore.class); Transaction tx = mock(Transaction.class); DocumentReference lock = mock(DocumentReference.class), user = mock(DocumentReference.class);
        var store = setup(db, tx, lock, user);
        var error = assertThrows(ApiCodeException.class, () -> store.transact(state -> {
            throw new ApiCodeException(HttpStatus.CONFLICT, "STAFF_CONFLICT", "Stale");
        }));
        assertEquals("STAFF_CONFLICT", error.getCode());
        verify(tx, never()).update(any(DocumentReference.class), anyMap());
        verify(tx, never()).set(any(DocumentReference.class), any());
        verify(tx, never()).delete(any(DocumentReference.class));
    }
}
