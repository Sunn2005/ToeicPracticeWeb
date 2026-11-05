package com.toeic.dao.ai.analysis;

import java.util.Map;
import java.util.Optional;

public interface AIAnalysisDao {
    Optional<Map<String, Object>> findByAttemptId(String attemptId) throws Exception;
}
