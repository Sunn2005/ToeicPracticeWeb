package com.toeic.dao.attempt;

import com.toeic.model.attempt.Attempt;
import com.toeic.model.attempt.AttemptAnswer;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AttemptDao {

    String nextId();

    void save(Attempt attempt) throws Exception;

    void updateTimestamp(String attemptId, long updatedAt) throws Exception;

    Optional<Attempt> findById(String attemptId) throws Exception;

    List<Attempt> findByUserId(String userId) throws Exception;

    List<Attempt> findHistoryByUserId(String userId) throws Exception;

    void delete(String attemptId) throws Exception;

    void saveAnswer(String attemptId, AttemptAnswer answer) throws Exception;

    Map<Integer, String> findAnswers(String attemptId) throws Exception;
}
