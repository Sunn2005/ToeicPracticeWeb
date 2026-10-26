package com.toeic.model.enums;

import java.util.Arrays;
import java.util.Optional;

/**
 * Pro plans sold through PayOS. Price and duration are fixed server-side;
 * the client only ever sends a planCode, never an amount.
 */
public enum ProPlan {
    PRO_30("PRO_30", 99_000L, 30, "CapyTOEIC Pro 30 days"),
    /** Cheap 1-day trial plan. Each account may buy it only once. */
    PRO_1DAY("PRO_1DAY", 10_000L, 1, "CapyTOEIC Pro 1 day");

    private final String code;
    private final long amount;
    private final int durationDays;
    private final String payosDescription;

    ProPlan(String code, long amount, int durationDays, String payosDescription) {
        this.code = code;
        this.amount = amount;
        this.durationDays = durationDays;
        this.payosDescription = payosDescription;
    }

    public String code() {
        return code;
    }

    public long amount() {
        return amount;
    }

    public int durationDays() {
        return durationDays;
    }

    public String payosDescription() {
        return payosDescription;
    }

    public static Optional<ProPlan> fromCode(String code) {
        return Arrays.stream(values()).filter(plan -> plan.code.equals(code)).findFirst();
    }
}
