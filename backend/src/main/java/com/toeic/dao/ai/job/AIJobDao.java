package com.toeic.dao.ai.job;

import com.toeic.model.ai.job.AIJob;
import com.toeic.model.ai.job.AIExplanationResult;

import java.util.Optional;

public interface AIJobDao {

    void save(AIJob job) throws Exception;

    Optional<AIJob> findById(String jobId) throws Exception;

    boolean markSucceeded(
            String jobId,
            AIExplanationResult result,
            long completedAt
    ) throws Exception;

    boolean markFailed(
            String jobId,
            String error,
            long completedAt
    ) throws Exception;
}
