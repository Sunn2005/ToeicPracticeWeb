package com.toeic.dao;

import com.toeic.model.AIJob;

import java.util.Map;
import java.util.Optional;

public interface AIJobDao {

    void save(AIJob job) throws Exception;

    Optional<AIJob> findById(String jobId) throws Exception;

    boolean markSucceeded(
            String jobId,
            Map<String, Object> result,
            long completedAt
    ) throws Exception;

    boolean markFailed(
            String jobId,
            String error,
            long completedAt
    ) throws Exception;
}