package com.toeic.service;

import com.toeic.controller.ApiCodeException;
import com.toeic.dao.PaymentOrderDao;
import com.toeic.dao.UserDao;
import com.toeic.model.PaymentOrder;
import com.toeic.model.User;
import com.toeic.model.enums.PaymentOrderStatus;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminPaymentService {
    private final PaymentOrderDao paymentOrderDao;
    private final UserDao userDao;

    public AdminPaymentService(PaymentOrderDao paymentOrderDao, UserDao userDao) {
        this.paymentOrderDao = paymentOrderDao;
        this.userDao = userDao;
    }

    public record AdminOrderView(long orderCode, String userId, String buyerEmail,
                                 String buyerName, String planCode, long amount, int durationDays,
                                 String status, String paymentLinkId, long createdAt, Long paidAt,
                                 Long proExpiresAt) { }

    public record AdminOrderPage(List<AdminOrderView> items, int page, int size,
                                 long totalItems, int totalPages) { }

    public AdminOrderPage listOrders(String status, String planCode, String userId, Long from,
                                     Long to, int page, int size) throws Exception {
        PaymentOrderStatus selectedStatus = null;
        if (hasValue(status)) {
            try {
                selectedStatus = PaymentOrderStatus.valueOf(status);
            } catch (IllegalArgumentException exception) {
                throw new ApiCodeException(HttpStatus.BAD_REQUEST, "PAYMENT_ORDER_FILTER_INVALID",
                        "Invalid payment order status");
            }
        }
        final PaymentOrderStatus statusFilter = selectedStatus;
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        List<PaymentOrder> filtered = paymentOrderDao.findAll().stream()
                .filter(order -> statusFilter == null || order.getStatus() == statusFilter)
                .filter(order -> !hasValue(planCode) || planCode.equals(order.getPlanCode()))
                .filter(order -> !hasValue(userId) || userId.equals(order.getUserId()))
                .filter(order -> from == null || order.getCreatedAt() >= from)
                .filter(order -> to == null || order.getCreatedAt() <= to)
                .sorted(Comparator.comparingLong(PaymentOrder::getCreatedAt).reversed()
                        .thenComparing(Comparator.comparingLong(PaymentOrder::getOrderCode).reversed()))
                .toList();
        Map<String, User> buyers = new HashMap<>();
        List<AdminOrderView> items = filtered.stream()
                .skip((long) safePage * safeSize).limit(safeSize)
                .map(order -> {
                    String uid = order.getUserId();
                    if (!buyers.containsKey(uid)) buyers.put(uid, findBuyer(uid));
                    return view(order, buyers.get(uid));
                }).toList();
        return new AdminOrderPage(items, safePage, safeSize, filtered.size(),
                (int) ((filtered.size() + (long) safeSize - 1) / safeSize));
    }

    public AdminOrderView getOrder(long orderCode) throws Exception {
        PaymentOrder order = paymentOrderDao.findByOrderCode(orderCode).orElseThrow(() ->
                new ApiCodeException(HttpStatus.NOT_FOUND, "PAYMENT_ORDER_NOT_FOUND", "Payment order not found"));
        return view(order, findBuyer(order.getUserId()));
    }

    private User findBuyer(String uid) {
        if (!hasValue(uid)) return null;
        try {
            return userDao.findByUid(uid).orElse(null);
        } catch (Exception exception) {
            // Buyer enrichment is optional; never hide an order if the user store is unavailable.
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            return null;
        }
    }

    private static boolean hasValue(String value) {
        return value != null && !value.isBlank();
    }

    private static AdminOrderView view(PaymentOrder order, User buyer) {
        return new AdminOrderView(order.getOrderCode(), order.getUserId(),
                buyer == null ? null : buyer.getEmail(), buyer == null ? null : buyer.getDisplayName(),
                order.getPlanCode(), order.getAmount(), order.getDurationDays(),
                order.getStatus() == null ? null : order.getStatus().name(), order.getPaymentLinkId(),
                order.getCreatedAt(), order.getPaidAt(), order.getProExpiresAt());
    }
}
