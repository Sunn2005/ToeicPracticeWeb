package com.toeic.dao.firestore;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.enums.PaymentOrderStatus;
import org.springframework.stereotype.Repository;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.function.Function;

@Repository
public class FirestorePaymentOrderDao implements PaymentOrderDao {
    private final Firestore firestore;

    public FirestorePaymentOrderDao(Firestore firestore) {
        this.firestore = firestore;
    }

    @Override
    public void save(PaymentOrder order) throws Exception {
        firestore.collection("paymentOrders").document(documentId(order.getOrderCode())).set(order).get();
    }

    @Override
    public Optional<PaymentOrder> findByOrderCode(long orderCode) throws Exception {
        DocumentSnapshot snapshot = firestore.collection("paymentOrders")
                .document(documentId(orderCode)).get().get();
        return Optional.ofNullable(orderFrom(snapshot));
    }

    @Override
    public Optional<PaymentOrder> findLatestPending(String userId, String planCode) throws Exception {
        return firestore.collection("paymentOrders")
                .whereEqualTo("userId", userId)
                .get().get().getDocuments().stream()
                .map(this::orderFrom)
                .filter(Objects::nonNull)
                .filter(order -> Objects.equals(planCode, order.getPlanCode()))
                .filter(order -> order.getStatus() == PaymentOrderStatus.PENDING)
                .max((left, right) -> Long.compare(left.getCreatedAt(), right.getCreatedAt()));
    }

    @Override
    public boolean existsPaidOrder(String userId, String planCode) throws Exception {
        return firestore.collection("paymentOrders")
                .whereEqualTo("userId", userId)
                .get().get().getDocuments().stream()
                .map(this::orderFrom)
                .filter(Objects::nonNull)
                .anyMatch(order -> Objects.equals(planCode, order.getPlanCode())
                        && order.getStatus() == PaymentOrderStatus.PAID);
    }

    @Override
    public PaymentOrder updateAtomically(long orderCode, Function<PaymentOrder, Mutation> mutation) throws Exception {
        var document = firestore.collection("paymentOrders").document(documentId(orderCode));
        try {
            return firestore.runTransaction(transaction -> {
                PaymentOrder current = orderFrom(transaction.get(document).get());
                Mutation result = mutation.apply(current);
                if (result.changed()) {
                    transaction.set(document, result.order());
                }
                return result.order();
            }).get();
        } catch (ExecutionException exception) {
            if (exception.getCause() instanceof RuntimeException cause) {
                throw cause;
            }
            throw exception;
        }
    }

    private PaymentOrder orderFrom(DocumentSnapshot snapshot) {
        if (snapshot == null || !snapshot.exists()) {
            return null;
        }
        return snapshot.toObject(PaymentOrder.class);
    }

    private static String documentId(long orderCode) {
        return String.valueOf(orderCode);
    }
}
