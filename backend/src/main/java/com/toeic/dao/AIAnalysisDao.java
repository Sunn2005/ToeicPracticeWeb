package com.toeic.dao;

import java.util.Map;
import java.util.Optional;

public interface AIAnalysisDao {
    Optional<Map<String, Object>> findByAttemptId(String attemptId) throws Exception;
}
