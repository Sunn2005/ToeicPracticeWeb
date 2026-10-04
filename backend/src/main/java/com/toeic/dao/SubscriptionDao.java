package com.toeic.dao;

import com.toeic.model.Subscription;

import java.util.Optional;
import java.util.function.Function;

public interface SubscriptionDao {
    Optional<Subscription> findByUserId(String userId) throws Exception;

    void save(Subscription subscription) throws Exception;

    /**
     * Re-evaluates the mutation on the latest snapshot when a concurrent write conflicts.
     * The current subscription may be null. The callback must be replayable without external side effects;
     * return changed=false for an idempotent no-op, or changed=true to replace the entire document.
     */
    Subscription updateAtomically(String userId, Function<Subscription, Mutation> mutation) throws Exception;

    record Mutation(Subscription subscription, boolean changed) { }
}
