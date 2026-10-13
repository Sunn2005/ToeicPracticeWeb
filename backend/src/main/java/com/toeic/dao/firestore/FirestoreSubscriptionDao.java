package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.dao.SubscriptionDao;
import com.toeic.model.Subscription;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.function.Function;

@Repository
public class FirestoreSubscriptionDao implements SubscriptionDao {
    private final Firestore firestore;

    public FirestoreSubscriptionDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public Optional<Subscription> findByUserId(String userId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("subscriptions").document(userId).get().get();
        return Optional.ofNullable(subscriptionFrom(snapshot));
    }

    private Subscription subscriptionFrom(DocumentSnapshot snapshot) {
        if (!snapshot.exists()) {
            return null;
        }
        Subscription subscription = snapshot.toObject(Subscription.class);
        if (subscription != null && subscription.getUserId() == null) {
            subscription.setUserId(snapshot.getId());
        }
        return subscription;
    }

    @Override
    public void save(Subscription subscription) throws Exception {
        firestore.collection("subscriptions").document(subscription.getUserId()).set(subscription).get();
    }

    @Override
    public Subscription updateAtomically(String userId, Function<Subscription, Mutation> mutation) throws Exception {
        var document = firestore.collection("subscriptions").document(userId);
        try {
            return firestore.runTransaction(transaction -> {
                Subscription current = subscriptionFrom(transaction.get(document).get());
                Mutation result = mutation.apply(current);
                if (result.changed()) {
                    transaction.set(document, result.subscription());
                }
                return result.subscription();
            }).get();
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof RuntimeException cause) {
                throw cause;
            }
            throw exception;
        }
    }
}
