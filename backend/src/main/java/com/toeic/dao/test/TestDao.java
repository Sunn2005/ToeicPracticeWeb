package com.toeic.dao.test;

import com.toeic.model.test.Test;
import com.toeic.model.test.TestPart;

import java.util.Optional;
import java.util.List;

public interface TestDao {

    Optional<Test> findMetadataById(String testId) throws Exception;

    Optional<TestPart> findPart(String testId, int partNumber) throws Exception;

    List<TestPart> findParts(String testId, List<Integer> partNumbers) throws Exception;

    List<Test> findAllMetadata() throws Exception;

    String nextId();

    void save(Test test) throws Exception;

    void delete(String testId) throws Exception;
}
