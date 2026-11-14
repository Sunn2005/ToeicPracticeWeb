package com.toeic.ai_service.service;

import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.WriteBatch;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.google.api.core.ApiFutures.immediateFuture;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ToeicKnowledgeIndexerTests {
    @Test
    void skipsUnapprovedIncompleteAndCurrentChunksAndContinuesAfterAnEmbeddingFailure() throws Exception {
        var firestore = mock(Firestore.class);
        var embeddings = mock(RagEmbeddingService.class);
        var tests = mock(CollectionReference.class);
        var query = mock(Query.class);
        var approved = mock(QueryDocumentSnapshot.class);
        var draft = mock(QueryDocumentSnapshot.class);
        var testRef = mock(DocumentReference.class);
        var parts = mock(CollectionReference.class);
        var part = mock(QueryDocumentSnapshot.class);

        when(firestore.collection("tests")).thenReturn(tests);
        when(tests.whereEqualTo("status", "APPROVED")).thenReturn(query);
        var testResults = snapshot(draft, approved);
        when(query.get()).thenReturn(immediateFuture(testResults));
        when(draft.getString("status")).thenReturn("DRAFT");
        when(approved.getString("status")).thenReturn("APPROVED");
        when(approved.getReference()).thenReturn(testRef);
        when(approved.getId()).thenReturn("test-1");
        when(testRef.collection("parts")).thenReturn(parts);
        var partResults = snapshot(part);
        when(parts.get()).thenReturn(immediateFuture(partResults));
        when(part.getLong("partNumber")).thenReturn(5L);
        when(part.getData()).thenReturn(Map.of(
                "questions", List.of(question(101, ""), question(102, "Already indexed"),
                        question(103, "Embedding fails")),
                "passageGroups", List.of(Map.of("passages", List.of(
                        Map.of("questions", List.of(question(104, "Embedding succeeds"))))))));

        var knowledge = mock(CollectionReference.class);
        when(firestore.collection("aiKnowledgeChunks")).thenReturn(knowledge);
        var current = mock(DocumentSnapshot.class);
        when(current.getString("embeddingModel")).thenReturn(RagEmbeddingService.MODEL);
        when(current.getLong("embeddingVersion")).thenReturn(1L);
        chunk(knowledge, 102, current);
        var missing = mock(DocumentSnapshot.class);
        chunk(knowledge, 103, missing);
        var saved = chunk(knowledge, 104, missing);
        var batch = mock(WriteBatch.class);
        when(firestore.batch()).thenReturn(batch);
        when(batch.commit()).thenReturn(immediateFuture(List.of()));
        when(embeddings.embedDocument("Part 5. Question 103: Question text Explanation: Embedding fails"))
                .thenThrow(new IllegalStateException());
        when(embeddings.embedDocument("Part 5. Question 104: Question text Explanation: Embedding succeeds"))
                .thenReturn(new double[768]);

        new ToeicKnowledgeIndexer(firestore, embeddings).run(null);

        verify(draft, never()).getReference();
        verify(knowledge, never()).document("test-1-101");
        verify(embeddings, never()).embedDocument("Part 5. Question 102: Question text Explanation: Already indexed");
        verify(batch).set(eq(saved), any());
        verify(batch).commit();
    }

    private QuerySnapshot snapshot(QueryDocumentSnapshot... documents) {
        var snapshot = mock(QuerySnapshot.class);
        when(snapshot.getDocuments()).thenReturn(List.of(documents));
        return snapshot;
    }

    private DocumentReference chunk(CollectionReference knowledge, int number, DocumentSnapshot existing) {
        var document = mock(DocumentReference.class);
        when(knowledge.document("test-1-" + number)).thenReturn(document);
        when(document.get()).thenReturn(immediateFuture(existing));
        return document;
    }

    private Map<String, Object> question(int number, String explanation) {
        return Map.of("questionNumber", number, "question", "Question text", "detailedExplanation", explanation);
    }
}
