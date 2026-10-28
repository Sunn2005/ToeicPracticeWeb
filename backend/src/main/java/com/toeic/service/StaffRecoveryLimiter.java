package com.toeic.service;

import com.google.cloud.firestore.Firestore;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

/** Shared across replicas; trust only the connection address, never client-supplied forwarding headers. */
@Service
public class StaffRecoveryLimiter {
    private final Firestore db;
    public StaffRecoveryLimiter(Firestore db) { this.db = db; }
    public boolean allow(String address) {
        try {
            String key = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(address.getBytes(StandardCharsets.UTF_8)));
            var ref = db.collection("staffRecoveryLimits").document(key);
            return db.runTransaction(tx -> {
                var snapshot = tx.get(ref).get(); long now = System.currentTimeMillis();
                Long since = snapshot.getLong("since"), count = snapshot.getLong("count");
                boolean fresh = since == null || now - since >= 60_000;
                if (!fresh && count != null && count >= 5) return false;
                tx.set(ref, Map.of("since", fresh ? now : since, "count", fresh ? 1L : (count == null ? 1 : count + 1)));
                return true;
            }).get();
        } catch (Exception ignored) { return false; }
    }
}
