package com.toeic.config;

import com.toeic.dao.TestDao;
import com.toeic.model.Test;
import com.toeic.model.TestPart;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

@Component
@ConditionalOnProperty(
        name = "app.import-toeic-data",
        havingValue = "true"
)
public class ToeicDataImportRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(ToeicDataImportRunner.class);
    private static final Set<Integer> EXPECTED_PART_NUMBERS = Set.of(1, 2, 3, 4, 5, 6, 7);

    private final TestDao testDao;
    private final ObjectMapper objectMapper;
    private final Resource dataResource;

    public ToeicDataImportRunner(
            TestDao testDao,
            ObjectMapper objectMapper,
            @Value("${app.toeic-data-resource}") Resource dataResource
    ) {
        this.testDao = testDao;
        this.objectMapper = objectMapper;
        this.dataResource = dataResource;
    }

    @Override
    public void run(String... args) throws Exception {
        if (!dataResource.exists()) {
            throw new IllegalStateException(
                    "Không tìm thấy file dữ liệu TOEIC: " + dataResource.getDescription()
            );
        }

        Test test;
        try (InputStream inputStream = dataResource.getInputStream()) {
            test = objectMapper.readValue(inputStream, Test.class);
        }

        validate(test);

        log.info(
                "Importing TOEIC testId={} with {} parts from {}",
                test.getTestId(),
                test.getParts().size(),
                dataResource.getDescription()
        );

        testDao.save(test);

        log.info(
                "Imported TOEIC testId={} successfully",
                test.getTestId()
        );
    }

    private void validate(Test test) {
        if (test.getTestId() == null || test.getTestId().isBlank()) {
            throw new IllegalArgumentException("Dữ liệu import thiếu field bắt buộc: testId");
        }
        if (test.getParts() == null) {
            throw new IllegalArgumentException("Dữ liệu import thiếu mảng parts");
        }
        Set<Integer> partNumbers = new HashSet<>();
        for (TestPart part : test.getParts()) {
            if (part.getPartNumber() == null) {
                throw new IllegalArgumentException("Part thiếu partNumber hợp lệ");
            }
            int partNumber = part.getPartNumber();
            if (!partNumbers.add(partNumber)) {
                throw new IllegalArgumentException("Trùng partNumber: " + partNumber);
            }
        }

        if (!partNumbers.equals(EXPECTED_PART_NUMBERS)) {
            throw new IllegalArgumentException(
                    "Dữ liệu phải có đủ partNumber 1-7, hiện tại: " + partNumbers
            );
        }
    }
}
