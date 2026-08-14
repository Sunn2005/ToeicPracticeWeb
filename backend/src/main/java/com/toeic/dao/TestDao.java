package com.toeic.dao;

import com.toeic.model.Test;
import com.toeic.model.TestPart;

import java.util.Optional;

public interface TestDao {

    Optional<Test> findMetadataById(String testId) throws Exception;

    Optional<TestPart> findPart(String testId, int partNumber) throws Exception;

    void save(Test test) throws Exception;
}
