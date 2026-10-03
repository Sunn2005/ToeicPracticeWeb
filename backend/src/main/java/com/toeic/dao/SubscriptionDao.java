package com.toeic.dao;

import com.toeic.model.Subscription;

import java.util.Optional;

public interface SubscriptionDao {
    Optional<Subscription> findByUserId(String userId) throws Exception;

    void save(Subscription subscription) throws Exception;
}
