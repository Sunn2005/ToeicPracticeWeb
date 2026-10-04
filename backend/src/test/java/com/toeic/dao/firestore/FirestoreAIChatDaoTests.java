package com.toeic.dao.firestore;

import com.google.api.core.ApiFutures;
import com.google.cloud.firestore.*;
import com.google.cloud.firestore.encoding.CustomClassMapper;
import com.toeic.controller.ApiCodeException;
import com.toeic.model.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FirestoreAIChatDaoTests {
    private static final long NOW = Instant.parse("2026-10-03T05:00:00Z").toEpochMilli();
    private final MemoryFirestore store = new MemoryFirestore();
    private final FirestoreAIChatDao dao = new FirestoreAIChatDao(store.firestore);

    @Test
    void activeListFiltersOwnerAndDeletedOrdersLatestFirstAndLimits() throws Exception {
        create("old", "learner", NOW - 100);
        create("new", "learner", NOW);
        create("foreign", "other", NOW + 100);
        create("deleted", "learner", NOW + 200);
        dao.softDeleteConversation("learner", "deleted", NOW + 300);
        assertEquals(List.of("new"), dao.listConversations("learner", 1).stream()
                .map(AIChatConversation::getId).toList());
        assertEquals(List.of("new", "old"), dao.listConversations("learner", 10).stream()
                .map(AIChatConversation::getId).toList());
    }

    @Test
    void conversationMappingPreservesContextLocaleAndTimestamps() throws Exception {
        var conversation = conversation("context", "learner", NOW);
        conversation.setContextAttemptId("attempt");
        conversation.setContextQuestionNumber(101);
        dao.createConversation(conversation, 10);
        assertNotNull(store.documents.get("aiChatConversations/context"), "Conversation transaction must persist the document");
        var found = dao.findConversation("learner", "context").orElseThrow();
        assertEquals("vi", found.getLocale());
        assertEquals("TOEIC", found.getTitle());
        assertEquals("attempt", found.getContextAttemptId());
        assertEquals(101, found.getContextQuestionNumber());
        assertEquals(NOW, found.getCreatedAt());
        assertEquals(NOW, found.getUpdatedAt());
        assertEquals(NOW, found.getLastMessageAt());
        assertEquals("ACTIVE", store.documents.get("aiChatConversations/context").get("status"));
    }

    @Test
    void foreignMissingAndDeletedConversationsAreNotReadable() throws Exception {
        create("chat", "learner", NOW);
        assertTrue(dao.findConversation("other", "chat").isEmpty());
        assertTrue(dao.findConversation("learner", "missing").isEmpty());
        assertCode("NOT_FOUND", HttpStatus.NOT_FOUND,
                () -> dao.listMessages("other", "chat", 20));
        assertCode("NOT_FOUND", HttpStatus.NOT_FOUND,
                () -> dao.softDeleteConversation("other", "chat", NOW));
        dao.softDeleteConversation("learner", "chat", NOW + 1);
        assertTrue(dao.findConversation("learner", "chat").isEmpty());
        assertCode("NOT_FOUND", HttpStatus.NOT_FOUND,
                () -> dao.listMessages("learner", "chat", 20));
    }

    @Test
    void acceptancePersistsPairJobAndQuotaInSpecifiedCollections() throws Exception {
        create("chat", "learner", NOW - 1);
        var accepted = send("chat", "key", NOW);
        assertTrue(accepted.newlyAccepted());
        assertEquals(AIChatMessage.Role.USER, accepted.userMessage().getRole());
        assertEquals(AIChatMessage.Status.SUCCEEDED, accepted.userMessage().getStatus());
        assertEquals("Explain TOEIC", accepted.userMessage().getContent());
        assertEquals(AIChatMessage.Role.ASSISTANT, accepted.assistantMessage().getRole());
        assertEquals(AIChatMessage.Status.PENDING, accepted.assistantMessage().getStatus());
        assertNull(accepted.assistantMessage().getContent());
        assertNull(accepted.assistantMessage().getCompletedAt());
        assertEquals(AIChatJob.Status.PENDING, accepted.job().getStatus());
        assertEquals(accepted.job().getId(), accepted.assistantMessage().getJobId());
        assertTrue(store.documents.containsKey("aiChatJobs/" + accepted.job().getId()));
        assertTrue(store.documents.containsKey("aiChatConversations/chat/messages/" + accepted.userMessage().getId()));
        assertTrue(store.documents.containsKey("aiChatConversations/chat/messages/" + accepted.assistantMessage().getId()));
        assertEquals(1, store.documents.get("aiChatUsage/learner_2026-10-03").get("acceptedCount"));
        assertEquals(List.of(NOW), store.documents.get("aiChatUsage/learner_2026-10-03").get("acceptedTimestamps"));
        assertEquals(29, accepted.quotaSummary().remainingDaily());
        assertEquals(Instant.parse("2026-10-03T17:00:00Z").toEpochMilli(), accepted.quotaSummary().nextResetAt());
        assertEquals(NOW, accepted.conversation().getLastMessageAt());
        assertEquals(List.of(accepted.userMessage().getId(), accepted.assistantMessage().getId()),
                dao.listMessages("learner", "chat", 20).stream().map(AIChatMessage::getId).toList());
    }

    @Test
    void duplicateKeyReturnsPersistedPairWithoutAnotherChargeEvenWhenQuotaIsFull() throws Exception {
        create("chat", "learner", NOW);
        var first = dao.acceptMessage("learner", "chat", "Explain TOEIC", "key", NOW, 1, 1);
        var before = store.copyDocuments();
        var again = dao.acceptMessage("learner", "chat", "Explain TOEIC", "key", NOW + 1, 1, 1);
        assertFalse(again.newlyAccepted());
        assertEquals(first.job().getId(), again.job().getId());
        assertEquals(first.userMessage().getId(), again.userMessage().getId());
        assertEquals(first.assistantMessage().getId(), again.assistantMessage().getId());
        assertEquals(0, again.quotaSummary().remainingDaily());
        assertEquals(before, store.documents);
    }

    @Test
    void keyCannotBeReusedWithDifferentContentOrConversation() throws Exception {
        create("chat", "learner", NOW);
        create("second", "learner", NOW);
        send("chat", "key", NOW);
        var before = store.copyDocuments();
        assertCode("CHAT_MESSAGE_INVALID", HttpStatus.BAD_REQUEST,
                () -> dao.acceptMessage("learner", "chat", "Different", "key", NOW + 1, 30, 5));
        assertCode("CHAT_MESSAGE_INVALID", HttpStatus.BAD_REQUEST,
                () -> send("second", "key", NOW + 1));
        assertEquals(before, store.documents);
    }

    @Test
    void dailyLimitRejectsThirtyFirstQuestionWithNoPartialWrites() throws Exception {
        create("chat", "learner", NOW);
        for (int i = 0; i < 30; i++) send("chat", "key-" + i, NOW + i * 60_000);
        var before = store.copyDocuments();
        assertCode("CHAT_DAILY_LIMIT_REACHED", HttpStatus.TOO_MANY_REQUESTS,
                () -> send("chat", "31", NOW + 30 * 60_000));
        assertEquals(before, store.documents);
    }

    @Test
    void rollingMinuteRejectsSixthThenAllowsExactlySixtySecondOldTimestamp() throws Exception {
        create("chat", "learner", NOW);
        for (int i = 0; i < 5; i++) send("chat", "key-" + i, NOW + i);
        var before = store.copyDocuments();
        assertCode("CHAT_RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS,
                () -> send("chat", "sixth", NOW + 59_999));
        assertEquals(before, store.documents);
        assertEquals(24, send("chat", "sixth", NOW + 60_000).quotaSummary().remainingDaily());
        assertEquals(5, ((List<?>) store.documents.get("aiChatUsage/learner_2026-10-03")
                .get("acceptedTimestamps")).size());
    }

    @Test
    void midnightResetsDailyButPreservesRollingBurstAcrossPreviousDay() throws Exception {
        long midnight = Instant.parse("2026-10-03T17:00:00Z").toEpochMilli();
        create("chat", "learner", midnight - 1000);
        for (int i = 0; i < 5; i++) send("chat", "key-" + i, midnight - 1000 + i);
        assertCode("CHAT_RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS,
                () -> send("chat", "new-day", midnight));
        var accepted = send("chat", "new-day", midnight + 60_000);
        assertEquals(29, accepted.quotaSummary().remainingDaily());
        assertEquals(Instant.parse("2026-10-04T17:00:00Z").toEpochMilli(), accepted.quotaSummary().nextResetAt());
        assertEquals(1, store.documents.get("aiChatUsage/learner_2026-10-04").get("acceptedCount"));
    }

    @Test
    void capIsTenAndSoftDeletionFreesOneSlotWithoutRemovingHistory() throws Exception {
        for (int i = 0; i < 10; i++) create("chat-" + i, "learner", NOW);
        var first = send("chat-0", "key", NOW);
        assertCode("CONVERSATION_LIMIT_REACHED", HttpStatus.CONFLICT,
                () -> create("eleventh", "learner", NOW));
        dao.softDeleteConversation("learner", "chat-0", NOW + 1);
        dao.softDeleteConversation("learner", "chat-0", NOW + 2);
        assertEquals("DELETED", store.documents.get("aiChatConversations/chat-0").get("status"));
        assertTrue(store.documents.containsKey("aiChatJobs/" + first.job().getId()));
        assertTrue(store.documents.containsKey("aiChatConversations/chat-0/messages/" + first.userMessage().getId()));
        create("eleventh", "learner", NOW + 3);
        assertEquals(10, dao.listConversations("learner", 20).size());
        assertCode("CONVERSATION_LIMIT_REACHED", HttpStatus.CONFLICT,
                () -> create("twelfth", "learner", NOW));
    }

    @Test
    void acceptanceAndOwnedJobLookupHideForeignDeletedAndMissingResources() throws Exception {
        create("chat", "learner", NOW);
        var first = send("chat", "key", NOW);
        assertEquals("learner", dao.findJob("learner", first.job().getId()).orElseThrow().getUserId());
        assertTrue(dao.findJob("other", first.job().getId()).isEmpty());
        assertTrue(dao.findJob("learner", "missing").isEmpty());
        assertCode("NOT_FOUND", HttpStatus.NOT_FOUND,
                () -> dao.acceptMessage("other", "chat", "Explain TOEIC", "other", NOW, 30, 5));
        dao.softDeleteConversation("learner", "chat", NOW);
        assertCode("NOT_FOUND", HttpStatus.NOT_FOUND, () -> send("chat", "key", NOW));
        assertTrue(dao.findJob("learner", first.job().getId()).isEmpty());
    }

    @Test
    void terminalSuccessAndFailureAreAtomicAndFirstDeliveryWins() throws Exception {
        create("chat", "learner", NOW);
        var first = send("chat", "key", NOW);
        assertTrue(finish(first.job(), AIChatJob.Status.SUCCEEDED, "TOEIC answer", null));
        var before = store.copyDocuments();
        assertFalse(finish(first.job(), AIChatJob.Status.FAILED, null, "AI_UNAVAILABLE"));
        assertFalse(finish(first.job(), AIChatJob.Status.SUCCEEDED, "Overwrite", null));
        assertEquals(before, store.documents);
        var job = dao.findJob("learner", first.job().getId()).orElseThrow();
        assertEquals(AIChatJob.Status.SUCCEEDED, job.getStatus());
        assertEquals(NOW + 10, job.getCompletedAt());
        var messages = dao.listMessages("learner", "chat", 20);
        assertEquals("TOEIC answer", messages.get(1).getContent());
        assertEquals(AIChatMessage.Status.SUCCEEDED, messages.get(1).getStatus());
        assertNull(messages.get(1).getErrorCode());
        var second = send("chat", "second", NOW + 1);
        assertTrue(finish(second.job(), AIChatJob.Status.FAILED, null, "AI_UNAVAILABLE"));
        var failed = dao.listMessages("learner", "chat", 20).get(3);
        assertEquals(AIChatMessage.Status.FAILED, failed.getStatus());
        assertEquals("AI_UNAVAILABLE", failed.getErrorCode());
        assertNull(failed.getContent());
    }

    @Test
    void finalizationRejectsForeignMismatchedMissingAndDeletedIdentifiers() throws Exception {
        create("chat", "learner", NOW);
        var job = send("chat", "key", NOW).job();
        var before = store.copyDocuments();
        assertFalse(dao.finalizeMessage("other", "chat", job.getId(), job.getAssistantMessageId(),
                AIChatJob.Status.SUCCEEDED, "answer", null, NOW));
        assertFalse(dao.finalizeMessage("learner", "wrong", job.getId(), job.getAssistantMessageId(),
                AIChatJob.Status.SUCCEEDED, "answer", null, NOW));
        assertFalse(dao.finalizeMessage("learner", "chat", job.getId(), "wrong",
                AIChatJob.Status.SUCCEEDED, "answer", null, NOW));
        assertFalse(dao.finalizeMessage("learner", "chat", "missing", job.getAssistantMessageId(),
                AIChatJob.Status.SUCCEEDED, "answer", null, NOW));
        assertEquals(before, store.documents);
        dao.softDeleteConversation("learner", "chat", NOW);
        assertFalse(finish(job, AIChatJob.Status.SUCCEEDED, "answer", null));
    }

    @Test
    void transactionRetryDoesNotMutateCapturedConversationOrDoubleCharge() throws Exception {
        var candidate = conversation("chat", "learner", NOW);
        store.retryNext = true;
        dao.createConversation(candidate, 10);
        store.retryNext = true;
        var accepted = send("chat", "key", NOW);
        assertTrue(accepted.newlyAccepted());
        assertEquals(1L, store.documents.get("aiChatUsage/learner_conversations").get("activeConversationCount"));
        assertEquals(1, store.documents.get("aiChatUsage/learner_2026-10-03").get("acceptedCount"));
        store.retryNext = true;
        assertTrue(finish(accepted.job(), AIChatJob.Status.SUCCEEDED, "answer", null));
        assertEquals(NOW, candidate.getUpdatedAt());
    }

    @Test
    void concurrentDuplicateAcceptanceProducesOnePairAndOneCharge() throws Exception {
        create("chat", "learner", NOW);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var results = new ArrayList<Future<com.toeic.dao.AIChatDao.AcceptedChatMessage>>();
            for (int i = 0; i < 2; i++) results.add(pool.submit(() -> {
                start.await();
                return send("chat", "same-key", NOW);
            }));
            start.countDown();
            var first = results.get(0).get(5, TimeUnit.SECONDS);
            var second = results.get(1).get(5, TimeUnit.SECONDS);
            assertEquals(first.job().getId(), second.job().getId());
            assertNotEquals(first.newlyAccepted(), second.newlyAccepted());
        }
        assertEquals(2, dao.listMessages("learner", "chat", 20).size());
        assertEquals(1, store.documents.get("aiChatUsage/learner_2026-10-03").get("acceptedCount"));
    }

    @Test
    void laterTransactionWithEarlierSampledServerTimeDoesNotRegressConversationActivity() throws Exception {
        create("chat", "learner", NOW);
        send("chat", "first", NOW + 500);
        send("chat", "second", NOW + 100);
        var conversation = dao.findConversation("learner", "chat").orElseThrow();
        assertEquals(NOW + 500, conversation.getLastMessageAt());
        assertEquals(NOW + 500, conversation.getUpdatedAt());
    }

    private void create(String id, String user, long now) throws Exception {
        dao.createConversation(conversation(id, user, now), 10);
    }

    private static AIChatConversation conversation(String id, String user, long now) {
        var conversation = new AIChatConversation();
        conversation.setId(id);
        conversation.setUserId(user);
        conversation.setTitle("TOEIC");
        conversation.setLocale("vi");
        conversation.setStatus(AIChatConversation.Status.ACTIVE);
        conversation.setCreatedAt(now);
        conversation.setUpdatedAt(now);
        conversation.setLastMessageAt(now);
        return conversation;
    }

    private com.toeic.dao.AIChatDao.AcceptedChatMessage send(String chat, String key, long now) throws Exception {
        return dao.acceptMessage("learner", chat, "Explain TOEIC", key, now, 30, 5);
    }

    private boolean finish(AIChatJob job, AIChatJob.Status status, String content, String error) throws Exception {
        return dao.finalizeMessage("learner", job.getConversationId(), job.getId(), job.getAssistantMessageId(),
                status, content, error, NOW + 10);
    }

    private static void assertCode(String code, HttpStatus status, Throwing action) {
        var error = assertThrows(ApiCodeException.class, action::run);
        assertEquals(code, error.getCode());
        assertEquals(status, error.getStatus());
    }

    @FunctionalInterface
    interface Throwing { void run() throws Exception; }

    /** External Firestore boundary only: staged atomic commits, retry replay, read-before-write and POJO mapping. */
    private static class MemoryFirestore {
        final Firestore firestore = mock(Firestore.class);
        final Map<String, Map<String, Object>> documents = new LinkedHashMap<>();
        final Map<DocumentReference, String> paths = new IdentityHashMap<>();
        final Map<Query, QueryState> queries = new IdentityHashMap<>();
        final Map<String, DocumentReference> references = new HashMap<>();
        boolean retryNext;

        MemoryFirestore() {
            when(firestore.collection(anyString())).thenAnswer(call -> collection(call.getArgument(0)));
            when(firestore.runTransaction(any())).thenAnswer(call -> {
                synchronized (documents) {
                    Transaction.Function<Object> callback = call.getArgument(0);
                    try {
                        if (retryNext) { retryNext = false; execute(callback, false); }
                        return ApiFutures.immediateFuture(execute(callback, true));
                    } catch (Exception exception) {
                        return ApiFutures.immediateFailedFuture(exception);
                    }
                }
            });
        }

        private Object execute(Transaction.Function<Object> callback, boolean commit) throws Exception {
            Transaction transaction = mock(Transaction.class);
            Map<String, Map<String, Object>> writes = new LinkedHashMap<>();
            when(transaction.get(any(DocumentReference.class))).thenAnswer(call -> {
                assertTrue(writes.isEmpty(), "Firestore transactions require all reads before writes");
                return ApiFutures.immediateFuture(snapshot(paths.get(call.getArgument(0)), false));
            });
            when(transaction.get(any(Query.class))).thenAnswer(call -> {
                assertTrue(writes.isEmpty(), "Firestore transactions require all reads before writes");
                return ApiFutures.immediateFuture(querySnapshot(queries.get(call.getArgument(0))));
            });
            org.mockito.stubbing.Answer<Transaction> write = call -> {
                writes.put(paths.get(call.getArgument(0)), toMap(call.getArgument(1)));
                return transaction;
            };
            when(transaction.set(any(DocumentReference.class), any(Object.class))).thenAnswer(write);
            when(transaction.set(any(DocumentReference.class), anyMap())).thenAnswer(write);
            Object result = callback.updateCallback(transaction);
            if (commit) documents.putAll(writes);
            return result;
        }

        private CollectionReference collection(String path) {
            CollectionReference collection = mock(CollectionReference.class);
            configureQuery(collection, new QueryState(path, Map.of(), null, Query.Direction.ASCENDING, Integer.MAX_VALUE));
            when(collection.document(anyString())).thenAnswer(call -> reference(path + "/" + call.getArgument(0)));
            return collection;
        }

        private DocumentReference reference(String path) {
            if (references.containsKey(path)) return references.get(path);
            DocumentReference document = mock(DocumentReference.class);
            references.put(path, document);
            paths.put(document, path);
            when(document.getId()).thenReturn(path.substring(path.lastIndexOf('/') + 1));
            when(document.get()).thenAnswer(call -> ApiFutures.immediateFuture(snapshot(path, false)));
            when(document.collection(anyString())).thenAnswer(call -> collection(path + "/" + call.getArgument(0)));
            return document;
        }

        private void configureQuery(Query query, QueryState state) {
            queries.put(query, state);
            when(query.whereEqualTo(anyString(), any())).thenAnswer(call -> {
                var filters = new HashMap<>(state.filters);
                Object value = call.getArgument(1);
                filters.put(call.getArgument(0), value instanceof Enum<?> e ? e.name() : value);
                return query(new QueryState(state.path, filters, state.order, state.direction, state.limit));
            });
            when(query.orderBy(anyString(), any(Query.Direction.class))).thenAnswer(call ->
                    query(new QueryState(state.path, state.filters, call.getArgument(0), call.getArgument(1), state.limit)));
            when(query.limit(anyInt())).thenAnswer(call ->
                    query(new QueryState(state.path, state.filters, state.order, state.direction, call.getArgument(0))));
            when(query.get()).thenAnswer(call -> ApiFutures.immediateFuture(querySnapshot(state)));
        }

        private Query query(QueryState state) {
            var query = mock(Query.class);
            configureQuery(query, state);
            return query;
        }

        @SuppressWarnings({"rawtypes", "unchecked"})
        private QuerySnapshot querySnapshot(QueryState state) {
            var matches = documents.entrySet().stream()
                    .filter(e -> e.getKey().startsWith(state.path + "/")
                            && !e.getKey().substring(state.path.length() + 1).contains("/"))
                    .filter(e -> state.filters.entrySet().stream().allMatch(f -> Objects.equals(e.getValue().get(f.getKey()), f.getValue())))
                    .sorted((a, b) -> {
                        int result = state.order == null ? 0 : ((Comparable) a.getValue().get(state.order)).compareTo(b.getValue().get(state.order));
                        return state.direction == Query.Direction.DESCENDING ? -result : result;
                    }).limit(state.limit).map(e -> (QueryDocumentSnapshot) snapshot(e.getKey(), true)).toList();
            var snapshot = mock(QuerySnapshot.class);
            when(snapshot.getDocuments()).thenReturn(matches);
            return snapshot;
        }

        private DocumentSnapshot snapshot(String path, boolean query) {
            DocumentSnapshot snapshot = query ? mock(QueryDocumentSnapshot.class) : mock(DocumentSnapshot.class);
            Map<String, Object> data = documents.get(path);
            when(snapshot.exists()).thenReturn(data != null);
            when(snapshot.getId()).thenReturn(path.substring(path.lastIndexOf('/') + 1));
            when(snapshot.getData()).thenReturn(data == null ? null : new LinkedHashMap<>(data));
            when(snapshot.getLong(anyString())).thenAnswer(call -> {
                Number value = data == null ? null : (Number) data.get(call.getArgument(0));
                return value == null ? null : value.longValue();
            });
            when(snapshot.toObject(any())).thenAnswer(call -> fromMap(data, call.getArgument(0)));
            return snapshot;
        }

        Map<String, Map<String, Object>> copyDocuments() {
            var copy = new LinkedHashMap<String, Map<String, Object>>();
            documents.forEach((key, value) -> copy.put(key, new LinkedHashMap<>(value)));
            return copy;
        }

        @SuppressWarnings("unchecked")
        private static Map<String, Object> toMap(Object object) throws Exception {
            if (object instanceof Map<?, ?> map) return new LinkedHashMap<>((Map<String, Object>) map);
            return (Map<String, Object>) CustomClassMapper.convertToPlainJavaTypes(object);
        }

        private static Object fromMap(Map<String, Object> data, Class<?> type) throws Exception {
            if (data == null) return null;
            return CustomClassMapper.convertToCustomClass(data, type, null);
        }

        private record QueryState(String path, Map<String, Object> filters, String order, Query.Direction direction, int limit) {}
    }
}
