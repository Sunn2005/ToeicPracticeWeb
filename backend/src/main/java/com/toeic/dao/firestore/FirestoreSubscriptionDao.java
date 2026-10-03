package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.dao.SubscriptionDao;
import com.toeic.model.Subscription;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class FirestoreSubscriptionDao implements SubscriptionDao {
    private final Firestore firestore;

    public FirestoreSubscriptionDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public Optional<Subscription> findByUserId(String userId) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("subscriptions").document(userId).get().get();
        if (!snapshot.exists()) {
            return Optional.empty();
        }
        Subscription subscription = snapshot.toObject(Subscription.class);
        if (subscription != null && subscription.getUserId() == null) {
            subscription.setUserId(snapshot.getId());
        }
        return Optional.ofNullable(subscription);
    }

    @Override
    public void save(Subscription subscription) throws Exception {
        firestore.collection("subscriptions").document(subscription.getUserId()).set(subscription).get();
    }
}
