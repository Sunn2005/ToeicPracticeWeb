package com.toeic.model;

import java.util.Arrays;
import java.util.Optional;

/**
 * Pro plans sold through PayOS. Price and duration are fixed server-side;
 * the client only ever sends a planCode, never an amount.
 */
public enum ProPlan {
    PRO_30("PRO_30", 99_000L, 30, false, "CapyTOEIC Pro 30 days"),
    /** Cheap 1-day plan for sandbox testing. Never sold when sandbox mode is off. */
    PRO_1DAY_TEST("PRO_1DAY_TEST", 10_000L, 1, true, "CapyTOEIC Pro 1 day");

    private final String code;
    private final long amount;
    private final int durationDays;
    private final boolean sandboxOnly;
    private final String payosDescription;

    ProPlan(String code, long amount, int durationDays, boolean sandboxOnly, String payosDescription) {
        this.code = code;
        this.amount = amount;
        this.durationDays = durationDays;
        this.sandboxOnly = sandboxOnly;
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

    public boolean sandboxOnly() {
        return sandboxOnly;
    }

    public String payosDescription() {
        return payosDescription;
    }

    public static Optional<ProPlan> fromCode(String code) {
        return Arrays.stream(values()).filter(plan -> plan.code.equals(code)).findFirst();
    }
}
