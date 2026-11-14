package com.toeic.ai_service.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.VectorQuery;
import com.google.cloud.firestore.VectorQueryOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
class RagRetrievalService {
    private static final Logger LOG = LoggerFactory.getLogger(RagRetrievalService.class);
    private static final String DISTANCE = "vectorDistance";

    private final Firestore firestore;
    private final RagEmbeddingService embeddings;
    private final int topK;
    private final double threshold;

    RagRetrievalService(
            Firestore firestore, RagEmbeddingService embeddings,
            @Value("${app.ai.rag.top-k:5}") int topK,
            @Value("${app.ai.rag.similarity-threshold:0.65}") double threshold
    ) {
        this.firestore = firestore;
        this.embeddings = embeddings;
        this.topK = topK;
        this.threshold = threshold;
    }

    List<Hit> retrieve(String currentMessage) {
        try {
            var options = VectorQueryOptions.newBuilder().setDistanceResultField(DISTANCE).build();
            // Even an approved test can be in progress. Project only learning metadata, never exam content.
            var result = firestore.collection(ToeicKnowledgeChunk.COLLECTION)
                    .select("partNumber", "questionNumber", "grammarTopic", "questionType", DISTANCE)
                    .findNearest("embedding", embeddings.embedQuery(currentMessage), topK,
                            VectorQuery.DistanceMeasure.COSINE, options)
                    .get().get(5, TimeUnit.SECONDS);
            var hits = filter(result.getDocuments());
            if (hits.isEmpty()) {
                LOG.warn("Capy RAG retrieval found no relevant learning metadata");
            } else {
                LOG.info("Capy RAG retrieval matched={}", hits.size());
            }
            return hits;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            LOG.warn("Capy RAG retrieval interrupted");
        } catch (ExecutionException | TimeoutException | RuntimeException exception) {
            LOG.warn("Capy RAG retrieval unavailable ({})", exception.getClass().getSimpleName());
        }
        return List.of();
    }

    List<Hit> filter(List<QueryDocumentSnapshot> documents) {
        return documents.stream()
                .map(document -> new Hit(document.getLong("partNumber"), document.getLong("questionNumber"),
                        similarity(document.getDouble(DISTANCE)),
                        document.getString("grammarTopic"), document.getString("questionType")))
                .filter(hit -> hit.partNumber() != null && hit.questionNumber() != null
                        && Double.isFinite(hit.similarity()) && hit.similarity() >= threshold
                        && (!ToeicKnowledgeChunk.text(hit.grammarTopic()).isEmpty()
                        || !ToeicKnowledgeChunk.text(hit.questionType()).isEmpty()))
                .sorted(Comparator.comparingDouble(Hit::similarity).reversed())
                .limit(topK)
                .toList();
    }

    private double similarity(Double cosineDistance) {
        return cosineDistance == null ? Double.NaN : 1 - cosineDistance;
    }

    record Hit(Long partNumber, Long questionNumber, double similarity, String grammarTopic, String questionType) {}
}
