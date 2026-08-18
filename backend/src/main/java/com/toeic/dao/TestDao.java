package com.toeic.dao;

import com.toeic.model.Test;
import com.toeic.model.TestPart;

import java.util.Optional;
import java.util.List;

public interface TestDao {

    Optional<Test> findMetadataById(String testId) throws Exception;

    Optional<TestPart> findPart(String testId, int partNumber) throws Exception;

    List<Test> findAllMetadata() throws Exception;

    String nextId();

    void save(Test test) throws Exception;

    void delete(String testId) throws Exception;
}
