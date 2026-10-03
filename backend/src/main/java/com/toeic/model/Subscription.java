package com.toeic.model;

import com.toeic.model.enums.Entitlement;
import com.toeic.model.enums.SubscriptionStatus;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class Subscription {
    private String userId;
    private String planCode;
    private SubscriptionStatus status;
    private List<Entitlement> entitlements;
    private Long startsAt;
    private Long expiresAt;
    private String activatedBy;
    private String revokedBy;
    private Long revokedAt;
    private Long createdAt;
    private Long updatedAt;
}
