package com.toeic.model;

import com.toeic.model.enums.PaymentOrderStatus;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class PaymentOrder {
    /** PayOS orderCode. Also the Firestore document id. Must be unique per order. */
    private long orderCode;
    private String userId;
    private String planCode;
    private long amount;
    private int durationDays;
    private PaymentOrderStatus status;
    private String paymentLinkId;
    private String checkoutUrl;
    /**
     * Absolute Pro expiry computed when the order flips to PAID. Stored so a retried
     * webhook reuses the exact same expiry instead of recomputing (and extending) it.
     */
    private Long proExpiresAt;
    private long createdAt;
    private Long paidAt;
    private long updatedAt;
}
