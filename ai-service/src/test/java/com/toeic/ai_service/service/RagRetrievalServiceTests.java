package com.toeic.ai_service.service;

import com.google.cloud.firestore.QueryDocumentSnapshot;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RagRetrievalServiceTests {
    @Test
    void filtersCosineDistancesAtTheThresholdAndCapsTheSortedResults() {
        var below = document(1, 0.36);
        var boundary = document(2, 0.35);
        var strongest = document(3, 0.10);
        var middle = document(4, 0.20);
        var documents = List.of(below, boundary, strongest, middle);
        var retrieval = new RagRetrievalService(null, null, 5, 0.65);
        assertEquals(List.of(3L, 4L, 2L), numbers(retrieval, documents));
        assertEquals(List.of(3L, 4L), numbers(new RagRetrievalService(null, null, 2, 0.65), documents));
    }

    private List<Long> numbers(RagRetrievalService retrieval, List<QueryDocumentSnapshot> documents) {
        return retrieval.filter(documents).stream().map(RagRetrievalService.Hit::questionNumber).toList();
    }

    private QueryDocumentSnapshot document(long number, double distance) {
        var document = mock(QueryDocumentSnapshot.class);
        when(document.getLong("partNumber")).thenReturn(5L);
        when(document.getLong("questionNumber")).thenReturn(number);
        when(document.getDouble("vectorDistance")).thenReturn(distance);
        when(document.getString("questionType")).thenReturn("GRAMMAR");
        return document;
    }
}
