package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.SetOptions;
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
        firestore.collection("users")
                .document(user.getUid())
                .set(user, SetOptions.merge())
                .get();
    }
}
