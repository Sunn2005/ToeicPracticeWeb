package com.toeic.ai_service.service;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.ai_service.model.AIChatRequest;
import com.toeic.ai_service.model.AIChatResult;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.Map;

@Repository
public class FirestoreChatResultRepository {
    private static final String COLLECTION = "aiChatGenerationResults";
    private static final long PROCESSING_LEASE_MS = 15 * 60 * 1000L;

    private final Firestore firestore;

    public FirestoreChatResultRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    public Claim claim(AIChatRequest request, boolean redelivered) throws Exception {
        DocumentReference reference = firestore.collection(COLLECTION).document(request.jobId());
        long now = System.currentTimeMillis();

        return firestore.runTransaction(transaction -> {
            DocumentSnapshot snapshot = transaction.get(reference).get();
            if (snapshot.exists()) {
                requireMatchingIdentifiers(snapshot, request);
                AIChatResult terminal = terminalResult(snapshot);
                if (terminal != null) return Claim.terminal(terminal);

                Long startedAt = snapshot.getLong("processingStartedAt");
                if (!redelivered && startedAt != null && now - startedAt < PROCESSING_LEASE_MS) {
                    return Claim.alreadyProcessing();
                }
            }

            Map<String, Object> document = identifiers(request);
            document.put("status", "PROCESSING");
            document.put("processingStartedAt", now);
            document.put("completedAt", null);
            document.put("answer", null);
            document.put("errorCode", null);
            transaction.set(reference, document);
            return Claim.claimed();
        }).get();
    }

    public AIChatResult saveTerminal(AIChatRequest request, AIChatResult result) throws Exception {
        requireMatchingResult(request, result);
        DocumentReference reference = firestore.collection(COLLECTION).document(request.jobId());
        long now = System.currentTimeMillis();

        return firestore.runTransaction(transaction -> {
            DocumentSnapshot snapshot = transaction.get(reference).get();
            if (!snapshot.exists()) {
                throw new IllegalStateException("AI chat result was not claimed");
            }
            requireMatchingIdentifiers(snapshot, request);
            AIChatResult existing = terminalResult(snapshot);
            if (existing != null) return existing;

            Map<String, Object> document = identifiers(request);
            document.put("status", result.status().name());
            document.put("processingStartedAt", snapshot.getLong("processingStartedAt"));
            document.put("completedAt", now);
            document.put("answer", result.answer());
            document.put("errorCode", result.errorCode());
            transaction.set(reference, document);
            return result;
        }).get();
    }

    private Map<String, Object> identifiers(AIChatRequest request) {
        Map<String, Object> document = new LinkedHashMap<>();
        document.put("jobId", request.jobId());
        document.put("userId", request.userId());
        document.put("conversationId", request.conversationId());
        document.put("assistantMessageId", request.assistantMessageId());
        return document;
    }

    private AIChatResult terminalResult(DocumentSnapshot snapshot) {
        String status = snapshot.getString("status");
        if (!("SUCCEEDED".equals(status) || "FAILED".equals(status))) return null;
        return new AIChatResult(
                snapshot.getString("userId"),
                snapshot.getString("conversationId"),
                snapshot.getString("jobId"),
                snapshot.getString("assistantMessageId"),
                AIChatResult.Status.valueOf(status),
                snapshot.getString("answer"),
                snapshot.getString("errorCode")
        );
    }

    private void requireMatchingIdentifiers(DocumentSnapshot snapshot, AIChatRequest request) {
        if (!request.jobId().equals(snapshot.getString("jobId"))
                || !request.userId().equals(snapshot.getString("userId"))
                || !request.conversationId().equals(snapshot.getString("conversationId"))
                || !request.assistantMessageId().equals(snapshot.getString("assistantMessageId"))) {
            throw new IllegalArgumentException("AI chat job identifiers do not match");
        }
    }

    private void requireMatchingResult(AIChatRequest request, AIChatResult result) {
        if (result == null || result.status() == null
                || !request.jobId().equals(result.jobId())
                || !request.userId().equals(result.userId())
                || !request.conversationId().equals(result.conversationId())
                || !request.assistantMessageId().equals(result.assistantMessageId())) {
            throw new IllegalArgumentException("AI chat result identifiers do not match");
        }
    }

    public enum ClaimStatus { CLAIMED, ALREADY_PROCESSING, TERMINAL }

    public record Claim(ClaimStatus status, AIChatResult result) {
        public static Claim claimed() {
            return new Claim(ClaimStatus.CLAIMED, null);
        }

        public static Claim alreadyProcessing() {
            return new Claim(ClaimStatus.ALREADY_PROCESSING, null);
        }

        public static Claim terminal(AIChatResult result) {
            return new Claim(ClaimStatus.TERMINAL, result);
        }
    }
}
