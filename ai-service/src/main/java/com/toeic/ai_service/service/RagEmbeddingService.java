package com.toeic.ai_service.service;

import com.google.genai.Client;
import com.google.genai.types.EmbedContentConfig;
import com.google.genai.types.HttpOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
class RagEmbeddingService {
    static final String MODEL = "gemini-embedding-001";
    static final int DIMENSIONS = 768;
    static final int VERSION = 1;

    private final Client client;
    private final HttpOptions httpOptions;

    RagEmbeddingService(
            Client client,
            @Value("${app.ai.rag.embedding-model:gemini-embedding-001}") String model,
            @Value("${app.ai.rag.embedding-dimensions:768}") int dimensions,
            @Value("${app.ai.rag.embedding-timeout-ms:30000}") int timeoutMs
    ) {
        if (!MODEL.equals(model) || dimensions != DIMENSIONS) {
            throw new IllegalArgumentException("Changing the RAG embedding model or dimensions requires a full re-index");
        }
        this.client = client;
        this.httpOptions = HttpOptions.builder().timeout(timeoutMs).build();
    }

    double[] embedDocument(String text) {
        return embed(text, "RETRIEVAL_DOCUMENT");
    }

    double[] embedQuery(String text) {
        return embed(text, "RETRIEVAL_QUERY");
    }

    private double[] embed(String text, String taskType) {
        var config = EmbedContentConfig.builder()
                .taskType(taskType)
                .outputDimensionality(DIMENSIONS)
                .httpOptions(httpOptions)
                .build();
        var embeddings = client.models.embedContent(MODEL, text, config).embeddings().orElse(List.of());
        if (embeddings.size() != 1) {
            throw new IllegalStateException("Expected one embedding");
        }
        var values = embeddings.getFirst().values().orElse(List.of());
        if (values.size() != DIMENSIONS || values.stream().anyMatch(value -> !Float.isFinite(value))) {
            throw new IllegalStateException("Invalid embedding vector");
        }
        return values.stream().mapToDouble(Float::doubleValue).toArray();
    }
}
