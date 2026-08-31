package com.toeic.dao;

import com.toeic.model.Attempt;
import com.toeic.model.AttemptAnswer;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface AttemptDao {

    String nextId();

    void save(Attempt attempt) throws Exception;

    void updateTimestamp(String attemptId, long updatedAt) throws Exception;

    Optional<Attempt> findById(String attemptId) throws Exception;

    List<Attempt> findByUserId(String userId) throws Exception;

    void delete(String attemptId) throws Exception;

    void saveAnswer(String attemptId, AttemptAnswer answer) throws Exception;

    Map<Integer, String> findAnswers(String attemptId) throws Exception;
}
