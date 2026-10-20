package com.toeic.dao;

import com.toeic.model.PaymentOrder;

import java.util.Optional;
import java.util.function.Function;

public interface PaymentOrderDao {
    void save(PaymentOrder order) throws Exception;

    Optional<PaymentOrder> findByOrderCode(long orderCode) throws Exception;

    Optional<PaymentOrder> findLatestPending(String userId, String planCode) throws Exception;

    /** True when the user already has a PAID order for this plan (e.g. the one-time trial). */
    boolean existsPaidOrder(String userId, String planCode) throws Exception;

    /**
     * Same replayable-mutation contract as {@link SubscriptionDao#updateAtomically}.
     * The current order may be null. Return changed=false for an idempotent no-op.
     */
    PaymentOrder updateAtomically(long orderCode, Function<PaymentOrder, Mutation> mutation) throws Exception;

    record Mutation(PaymentOrder order, boolean changed) { }
}
