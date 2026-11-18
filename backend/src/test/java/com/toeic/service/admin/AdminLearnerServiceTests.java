package com.toeic.service.admin;

import com.toeic.dao.firestore.FirestoreAdminLearnerReader.CompletedAttempt;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AdminLearnerServiceTests {
    @Test
    void serializesDetailFieldsAtTheResponseRoot() throws Exception {
        var detail = new AdminLearnerService.Detail(
                new AdminLearnerService.Learner("user-1", "Learner", "learner@example.com", null,
                        null, null, null, null, AdminLearnerService.ProStatus.FREE),
                new AdminLearnerService.Statistics(0, 0, null, null, null));

        String response = new ObjectMapper().writeValueAsString(detail);

        assertThat(response).contains("\"uid\":\"user-1\"");
        assertThat(response).doesNotContain("\"learner\"");
    }

    @Test
    void summarizesCompletedExamAndPracticeAttemptsWithoutInventingMissingScores() {
        var statistics = AdminLearnerService.summarize(List.of(
                new CompletedAttempt("FULL_TEST", 100L, 100L, 100L, 420L, 380L),
                new CompletedAttempt("FULL_TEST", 300L, 100L, 100L, 405L, 410L),
                new CompletedAttempt("PRACTICE", 400L, null, null, null, null),
                new CompletedAttempt("FULL_TEST", 200L, 0L, 0L, 495L, 495L)
        ));

        assertThat(statistics.completedExamAttempts()).isEqualTo(3);
        assertThat(statistics.completedPracticeAttempts()).isEqualTo(1);
        assertThat(statistics.bestListeningScore()).isEqualTo(420L);
        assertThat(statistics.bestReadingScore()).isEqualTo(410L);
        assertThat(statistics.lastStudyAt()).isEqualTo(400L);
    }

    @Test
    void declaresCompositeIndexRequiredByAdminOrdersQuery() throws Exception {
        Path file = Path.of("..", "firestore.indexes.json");
        var indexes = new ObjectMapper().readTree(Files.readString(file)).get("indexes");

        boolean declared = false;
        for (var index : indexes) {
            var fields = index.get("fields");
            declared |= "paymentOrders".equals(index.get("collectionGroup").asString())
                    && "COLLECTION".equals(index.get("queryScope").asString())
                    && fields.size() == 3
                    && field(fields.get(0), "userId", "ASCENDING")
                    && field(fields.get(1), "createdAt", "DESCENDING")
                    && field(fields.get(2), "orderCode", "DESCENDING");
        }

        assertThat(declared).isTrue();
    }

    private static boolean field(tools.jackson.databind.JsonNode node, String path, String order) {
        return path.equals(node.get("fieldPath").asString()) && order.equals(node.get("order").asString());
    }
}
