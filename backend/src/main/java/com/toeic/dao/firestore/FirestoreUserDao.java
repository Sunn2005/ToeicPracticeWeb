package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.dao.UserDao;
import com.toeic.model.User;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class FirestoreUserDao implements UserDao {

    private final Firestore firestore;

    public FirestoreUserDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public Optional<User> findByUid(String uid) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("users").document(uid).get().get();
        if (!snapshot.exists()) {
            return Optional.empty();
        }
        return Optional.of(FirestoreUserMapper.from(uid, snapshot.getData()));
    }

    @Override
    public void save(User user) throws Exception {
        var reference = firestore.collection("users").document(user.getUid());
        firestore.runTransaction(tx -> {
            var existing = tx.get(reference).get();
            if (!existing.exists()) { tx.create(reference, user); return null; }
            java.util.Map<String, Object> fields = new java.util.HashMap<>();
            fields.put("displayName", user.getDisplayName()); fields.put("photoUrl", user.getPhotoUrl());
            fields.put("targetScore", user.getTargetScore()); fields.put("phoneNumber", user.getPhoneNumber());
            fields.put("dateOfBirth", user.getDateOfBirth()); fields.put("gender", user.getGender());
            fields.put("lastLoginAt", user.getLastLoginAt());
            if (existing.get("role") == null) fields.put("role", "USER");
            tx.update(reference, fields); return null;
        }).get();
    }
}
