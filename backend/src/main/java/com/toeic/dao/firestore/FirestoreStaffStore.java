package com.toeic.dao.firestore;

import com.google.cloud.firestore.*;
import com.toeic.dao.StaffStore;
import com.toeic.model.StaffGroup;
import com.toeic.model.User;
import com.toeic.service.StaffPermissions;
import org.springframework.stereotype.Repository;
import java.util.*;
import java.util.function.Function;

@Repository
public class FirestoreStaffStore implements StaffStore {
    private final Firestore db;
    public FirestoreStaffStore(Firestore db) { this.db = db; }
    private DocumentReference lock() { return db.collection("staffManagement").document("state"); }
    private State state(QuerySnapshot users, QuerySnapshot groups, boolean initialized) {
        Map<String, User> people = new LinkedHashMap<>();
        for (var doc : users.getDocuments()) {
            User user = FirestoreUserMapper.from(doc.getId(), doc.getData());
            people.put(doc.getId(), user);
        }
        Map<String, StaffGroup> teams = initialized ? new LinkedHashMap<>() : StaffPermissions.defaults();
        for (var doc : groups.getDocuments()) {
            StaffGroup group = doc.toObject(StaffGroup.class); group.setId(doc.getId());
            group.setPermissions(StaffPermissions.withoutRetired(group.getPermissions()));
            teams.put(doc.getId(), group);
        }
        return new State(people, teams);
    }
    @Override public State read() throws Exception {
        State result = state(db.collection("users").get().get(), db.collection("staffGroups").get().get(), lock().get().get().exists());
        result.migrateLegacy(); return result;
    }
    @Override public StaffGroup findGroup(String id) throws Exception {
        var snapshot = db.collection("staffGroups").document(id).get().get();
        if (snapshot.exists()) {
            StaffGroup group = snapshot.toObject(StaffGroup.class);
            group.setPermissions(StaffPermissions.withoutRetired(group.getPermissions()));
            return group;
        }
        return lock().get().get().exists() ? null : StaffPermissions.defaults().get(id);
    }
    @Override public <T> T transact(Function<State, T> mutation) throws Exception {
        try {
            return db.runTransaction(tx -> {
                var marker = tx.get(lock()).get();
                State data = state(tx.get(db.collection("users")).get(), tx.get(db.collection("staffGroups")).get(), marker.exists());
                Map<String, Map<String, Object>> before = new HashMap<>();
                data.users().forEach((id, user) -> before.put(id, staffFields(user)));
                Map<String, StaffGroup> oldGroups = new HashMap<>(data.groups());
                data.migrateLegacy();
                T result = mutation.apply(data);
                for (var entry : data.users().entrySet()) {
                    Map<String, Object> fields = staffFields(entry.getValue());
                    if (!before.containsKey(entry.getKey())) tx.create(db.collection("users").document(entry.getKey()), entry.getValue());
                    else if (!fields.equals(before.get(entry.getKey()))) tx.update(db.collection("users").document(entry.getKey()), fields);
                }
                for (var group : data.groups().values()) tx.set(db.collection("staffGroups").document(group.getId()), group);
                for (String id : oldGroups.keySet()) if (!data.groups().containsKey(id)) tx.delete(db.collection("staffGroups").document(id));
                tx.set(lock(), Map.of("revision", marker.exists() ? marker.getLong("revision") + 1 : 1L));
                return result;
            }).get();
        } catch (java.util.concurrent.ExecutionException exception) {
            Throwable cause = exception;
            while (cause.getCause() != null) {
                cause = cause.getCause();
                if (cause instanceof com.toeic.controller.ApiCodeException business) throw business;
            }
            throw exception;
        }
    }
    private Map<String, Object> staffFields(User user) {
        Map<String, Object> fields = new HashMap<>();
        fields.put("role", user.getRole() == null ? "USER" : user.getRole().name());
        fields.put("staffGroupId", user.getStaffGroupId()); fields.put("staffActive", user.getStaffActive());
        fields.put("staffNotes", user.getStaffNotes()); fields.put("staffVersion", user.getStaffVersion());
        fields.put("credentialsChangedAt", user.getCredentialsChangedAt());
        fields.put("credentialVersion", user.getCredentialVersion());
        fields.put("staffProvisioned", user.getStaffProvisioned());
        fields.put("passwordChangeRequired", user.getPasswordChangeRequired());
        fields.put("temporaryPasswordExpiresAt", user.getTemporaryPasswordExpiresAt());
        fields.put("credentialEmailStatus", user.getCredentialEmailStatus());
        fields.put("credentialLastSentAt", user.getCredentialLastSentAt());
        fields.put("credentialOperation", user.getCredentialOperation());
        fields.put("staffResetTokenHash", user.getStaffResetTokenHash());
        fields.put("staffResetExpiresAt", user.getStaffResetExpiresAt());
        fields.put("staffResetRequestedAt", user.getStaffResetRequestedAt());
        return fields;
    }
}
