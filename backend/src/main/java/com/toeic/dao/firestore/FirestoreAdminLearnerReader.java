package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldMask;
import com.google.cloud.firestore.FieldPath;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.toeic.model.billing.PaymentOrder;
import com.toeic.model.billing.Subscription;
import com.toeic.model.user.User;
import com.toeic.model.user.enums.UserRole;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class FirestoreAdminLearnerReader {
    private static final String[] PROFILE_FIELDS = {
            "role", "displayName", "email", "photoUrl", "targetScore", "createdAt", "lastLoginAt"
    };

    private final Firestore firestore;

    public FirestoreAdminLearnerReader(Firestore firestore) {
        this.firestore = firestore;
    }

    public List<User> usersAfter(String uid, int limit) throws Exception {
        Query query = firestore.collection("users")
                .whereEqualTo("role", UserRole.USER.name())
                .orderBy(FieldPath.documentId())
                .select(PROFILE_FIELDS);
        if (uid != null) {
            query = query.startAfter(uid);
        }
        return query.limit(limit).get().get().getDocuments().stream()
                .map(document -> FirestoreUserMapper.from(document.getId(), document.getData()))
                .toList();
    }

    public Optional<User> learner(String uid) throws Exception {
        DocumentReference reference = firestore.collection("users").document(uid);
        DocumentSnapshot snapshot = firestore.getAll(
                new DocumentReference[]{reference},
                FieldMask.of(PROFILE_FIELDS)
        ).get().getFirst();
        if (!UserRole.USER.name().equals(snapshot.getString("role"))) {
            return Optional.empty();
        }
        return Optional.of(FirestoreUserMapper.from(snapshot.getId(), snapshot.getData()));
    }

    public Map<String, Subscription> subscriptions(List<String> uids) throws Exception {
        if (uids.isEmpty()) {
            return Map.of();
        }
        var collection = firestore.collection("subscriptions");
        DocumentReference[] references = uids.stream().map(collection::document)
                .toArray(DocumentReference[]::new);
        Map<String, Subscription> subscriptions = new HashMap<>();
        for (DocumentSnapshot snapshot : firestore.getAll(references, FieldMask.of(
                "status", "startsAt", "expiresAt")).get()) {
            if (snapshot.exists()) {
                subscriptions.put(snapshot.getId(), snapshot.toObject(Subscription.class));
            }
        }
        return subscriptions;
    }

    public List<CompletedAttempt> completedAttempts(String uid) throws Exception {
        return firestore.collection("attempts")
                .whereEqualTo("userId", uid)
                .whereEqualTo("status", "COMPLETED")
                .select("type", "submittedAt", "result.listeningTotalQuestions", "result.readingTotalQuestions",
                        "result.listeningScore", "result.readingScore")
                .get().get().getDocuments().stream()
                .map(document -> completedAttempt(document.getString("type"),
                        FirestoreUserMapper.epochMillis(document.get("submittedAt"), "submittedAt"),
                        document.get("result")))
                .toList();
    }

    public List<PaymentOrder> orders(String uid, Long createdAt, Long orderCode, int limit) throws Exception {
        Query query = firestore.collection("paymentOrders")
                .whereEqualTo("userId", uid)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .orderBy("orderCode", Query.Direction.DESCENDING)
                .select("orderCode", "planCode", "amount", "durationDays", "status", "createdAt", "paidAt");
        if (createdAt != null) {
            query = query.startAfter(createdAt, orderCode);
        }
        return query.limit(limit).get().get().getDocuments().stream()
                .map(document -> document.toObject(PaymentOrder.class))
                .toList();
    }

    public record CompletedAttempt(String type, Long submittedAt, Long listeningQuestions, Long readingQuestions,
                                   Long listeningScore, Long readingScore) {}

    private static CompletedAttempt completedAttempt(String type, Long submittedAt, Object value) {
        Map<?, ?> result = value instanceof Map<?, ?> map ? map : Map.of();
        return new CompletedAttempt(type, submittedAt, number(result.get("listeningTotalQuestions")),
                number(result.get("readingTotalQuestions")), number(result.get("listeningScore")),
                number(result.get("readingScore")));
    }

    private static Long number(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }
}
