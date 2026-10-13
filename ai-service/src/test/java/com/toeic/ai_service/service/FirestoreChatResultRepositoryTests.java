package com.toeic.ai_service.service;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Transaction;
import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FirestoreChatResultRepositoryTests {
    private final Firestore firestore = mock(Firestore.class);
    private final CollectionReference collection = mock(CollectionReference.class);
    private final DocumentReference document = mock(DocumentReference.class);
    private final DocumentSnapshot snapshot = mock(DocumentSnapshot.class);
    private final Transaction transaction = mock(Transaction.class);
    private final FirestoreChatResultRepository repository = new FirestoreChatResultRepository(firestore);

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        when(firestore.collection("aiChatGenerationResults")).thenReturn(collection);
        when(collection.document("job")).thenReturn(document);
        when(transaction.get(document)).thenReturn(ApiFutures.immediateFuture(snapshot));
        when(firestore.runTransaction(any())).thenAnswer(invocation -> {
            Transaction.Function<Object> callback = invocation.getArgument(0);
            try {
                return ApiFutures.immediateFuture(callback.updateCallback(transaction));
            } catch (Exception exception) {
                return ApiFutures.immediateFailedFuture(exception);
            }
        });
    }

    @Test
    void firstClaimStoresOnlyIdentifiersAndProcessingMetadata() throws Exception {
        when(snapshot.exists()).thenReturn(false);

        FirestoreChatResultRepository.Claim claim = repository.claim(request(), false);

        assertEquals(FirestoreChatResultRepository.ClaimStatus.CLAIMED, claim.status());
        ArgumentCaptor<Map<String, Object>> payload = mapCaptor();
        verify(transaction).set(eq(document), payload.capture());
        assertEquals("job", payload.getValue().get("jobId"));
        assertEquals("user", payload.getValue().get("userId"));
        assertEquals("conversation", payload.getValue().get("conversationId"));
        assertEquals("assistant-message", payload.getValue().get("assistantMessageId"));
        assertEquals("PROCESSING", payload.getValue().get("status"));
        assertFalse(payload.getValue().containsKey("history"));
        assertFalse(payload.getValue().containsKey("currentMessage"));
        assertFalse(payload.getValue().containsKey("questionContext"));
    }

    @Test
    void terminalClaimReturnsTheSavedResultWithoutWriting() throws Exception {
        storedIdentifiers("SUCCEEDED");
        when(snapshot.getString("answer")).thenReturn("Saved answer");

        FirestoreChatResultRepository.Claim claim = repository.claim(request(), false);

        assertEquals(FirestoreChatResultRepository.ClaimStatus.TERMINAL, claim.status());
        assertEquals("Saved answer", claim.result().answer());
        verify(transaction, never()).set(eq(document), any());
    }

    @Test
    void activeClaimWaitsButRecoveryCanReclaimTheLease() throws Exception {
        storedIdentifiers("PROCESSING");
        when(snapshot.getLong("processingStartedAt")).thenReturn(System.currentTimeMillis());

        assertEquals(FirestoreChatResultRepository.ClaimStatus.ALREADY_PROCESSING,
                repository.claim(request(), false).status());
        assertEquals(FirestoreChatResultRepository.ClaimStatus.CLAIMED,
                repository.claim(request(), true).status());
    }

    @Test
    void terminalSavePersistsTheExactSanitizedResult() throws Exception {
        storedIdentifiers("PROCESSING");
        when(snapshot.getLong("processingStartedAt")).thenReturn(123L);
        AIChatResult result = AIChatResult.succeeded(request(), "Saved answer");

        assertEquals(result, repository.saveTerminal(request(), result));

        ArgumentCaptor<Map<String, Object>> payload = mapCaptor();
        verify(transaction).set(eq(document), payload.capture());
        assertEquals("SUCCEEDED", payload.getValue().get("status"));
        assertEquals("Saved answer", payload.getValue().get("answer"));
        assertEquals(123L, payload.getValue().get("processingStartedAt"));
        assertFalse(payload.getValue().containsKey("history"));
        assertFalse(payload.getValue().containsKey("currentMessage"));
    }

    @Test
    void firstTerminalResultWinsAndForeignIdentifiersAreRejected() throws Exception {
        storedIdentifiers("SUCCEEDED");
        when(snapshot.getString("answer")).thenReturn("First answer");
        AIChatResult laterFailure = AIChatResult.failed(request(), "AI_UNAVAILABLE");

        AIChatResult retained = repository.saveTerminal(request(), laterFailure);
        assertEquals(AIChatResult.Status.SUCCEEDED, retained.status());
        assertEquals("First answer", retained.answer());
        verify(transaction, never()).set(eq(document), any());

        when(snapshot.getString("userId")).thenReturn("foreign-user");
        ExecutionException mismatch = assertThrows(
                ExecutionException.class, () -> repository.claim(request(), true));
        assertEquals(IllegalArgumentException.class, mismatch.getCause().getClass());
    }

    private void storedIdentifiers(String status) {
        when(snapshot.exists()).thenReturn(true);
        when(snapshot.getString("jobId")).thenReturn("job");
        when(snapshot.getString("userId")).thenReturn("user");
        when(snapshot.getString("conversationId")).thenReturn("conversation");
        when(snapshot.getString("assistantMessageId")).thenReturn("assistant-message");
        when(snapshot.getString("status")).thenReturn(status);
    }

    private AIChatRequest request() {
        return new AIChatRequest("user", "conversation", "job", "user-message",
                "assistant-message", "vi", List.of(), "Explain", null);
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private ArgumentCaptor<Map<String, Object>> mapCaptor() {
        return (ArgumentCaptor) ArgumentCaptor.forClass(Map.class);
    }
}
