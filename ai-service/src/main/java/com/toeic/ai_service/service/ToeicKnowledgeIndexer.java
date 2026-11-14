package com.toeic.ai_service.service;

import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Component
@ConditionalOnProperty(name = "app.ai.rag.index-enabled", havingValue = "true")
class ToeicKnowledgeIndexer implements ApplicationRunner {
    private static final Logger LOG = LoggerFactory.getLogger(ToeicKnowledgeIndexer.class);
    private static final int BATCH_SIZE = 20;

    private final Firestore firestore;
    private final RagEmbeddingService embeddings;

    ToeicKnowledgeIndexer(Firestore firestore, RagEmbeddingService embeddings) {
        this.firestore = firestore;
        this.embeddings = embeddings;
    }

    @Override
    public void run(ApplicationArguments args) throws InterruptedException {
        var counts = new Counts();
        try {
            var approved = firestore.collection("tests").whereEqualTo("status", "APPROVED").get().get();
            for (QueryDocumentSnapshot test : approved.getDocuments()) {
                if (!"APPROVED".equals(test.getString("status"))) {
                    continue;
                }
                indexTest(test, counts);
            }
        } catch (ExecutionException exception) {
            throw new IllegalStateException("Could not read approved tests for Capy RAG indexing");
        } finally {
            LOG.info("Capy RAG indexing totals: indexed={}, skipped={}, failed={}",
                    counts.indexed, counts.skipped, counts.failed);
        }
    }

    private void indexTest(QueryDocumentSnapshot test, Counts counts)
            throws ExecutionException, InterruptedException {
        var chunks = new ArrayList<ToeicKnowledgeChunk>();
        for (QueryDocumentSnapshot part : test.getReference().collection("parts").get().get().getDocuments()) {
            Long partNumber = part.getLong("partNumber");
            if (partNumber == null) {
                LOG.warn("Skipping part without a part number in Capy RAG indexing");
                continue;
            }
            collect(test.getId(), partNumber, part.getData(), "", chunks, counts);
        }
        for (int start = 0; start < chunks.size(); start += BATCH_SIZE) {
            indexBatch(chunks.subList(start, Math.min(start + BATCH_SIZE, chunks.size())), counts);
        }
    }

    private void collect(String testId, long partNumber, Map<?, ?> container, String parentTranscript,
                         List<ToeicKnowledgeChunk> chunks, Counts counts) {
        if (container.get("questions") instanceof List<?> questions) {
            for (Object item : questions) {
                if (!(item instanceof Map<?, ?> question) || !(question.get("questionNumber") instanceof Number)
                        || ToeicKnowledgeChunk.text(question.get("question")).isEmpty()
                        || ToeicKnowledgeChunk.text(question.get("detailedExplanation")).isEmpty()) {
                    counts.skipped++;
                    LOG.warn("Skipping question with missing number, text or explanation in Capy RAG indexing");
                    continue;
                }
                chunks.add(ToeicKnowledgeChunk.from(testId, partNumber, question, parentTranscript));
            }
        }
        for (String field : List.of("groups", "passages", "passageGroups")) {
            if (container.get(field) instanceof List<?> groups) {
                for (Object item : groups) {
                    if (item instanceof Map<?, ?> group) {
                        String transcript = ToeicKnowledgeChunk.text(group.get("transcript"));
                        collect(testId, partNumber, group, transcript.isEmpty() ? parentTranscript : transcript,
                                chunks, counts);
                    }
                }
            }
        }
    }

    private void indexBatch(List<ToeicKnowledgeChunk> chunks, Counts counts) throws InterruptedException {
        var collection = firestore.collection(ToeicKnowledgeChunk.COLLECTION);
        var batch = firestore.batch();
        int pending = 0;
        for (ToeicKnowledgeChunk chunk : chunks) {
            try {
                var reference = collection.document(chunk.id());
                var existing = reference.get().get();
                if (RagEmbeddingService.MODEL.equals(existing.getString("embeddingModel"))
                        && Long.valueOf(RagEmbeddingService.VERSION).equals(existing.getLong("embeddingVersion"))) {
                    counts.skipped++;
                    continue;
                }
                String text = chunk.embeddingText();
                batch.set(reference, chunk.document(text, embeddings.embedDocument(text)));
                pending++;
            } catch (ExecutionException | RuntimeException exception) {
                counts.failed++;
                LOG.warn("Could not prepare Capy RAG chunk ({})", exception.getClass().getSimpleName());
            }
        }
        if (pending > 0) {
            try {
                batch.commit().get();
                counts.indexed += pending;
            } catch (ExecutionException | RuntimeException exception) {
                counts.failed += pending;
                LOG.warn("Could not save Capy RAG batch ({})", exception.getClass().getSimpleName());
            }
        }
    }

    private static class Counts {
        private int indexed;
        private int skipped;
        private int failed;
    }
}
