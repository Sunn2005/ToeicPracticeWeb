package com.toeic.controller;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.FirestoreClient;
import com.toeic.dto.OptionResponse;
import com.toeic.dto.QuestionResponse;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tests")
@CrossOrigin(origins = "http://localhost:5173")
public class TestController {

    @GetMapping("/{testId}/parts/{partId}")
    public Map<String, Object> getPart(
            @PathVariable String testId,
            @PathVariable String partId
    ) throws Exception {

        Firestore db = FirestoreClient.getFirestore();

        ApiFuture<DocumentSnapshot> future = db
                .collection("tests")
                .document(testId)
                .collection("parts")
                .document(partId)
                .get();

        DocumentSnapshot document = future.get();

        if (!document.exists()) {
            throw new RuntimeException("Không tìm thấy part");
        }

        Map<String, Object> data = document.getData();

        // Danh sách câu hỏi gốc từ Firestore
        List<Map<String, Object>> questions =
                (List<Map<String, Object>>) data.get("questions");

        List<QuestionResponse> questionResponses = new ArrayList<>();

        for (Map<String, Object> question : questions) {

            Long numberLong = (Long) question.get("number");
            int number = numberLong.intValue();

            String content = (String) question.get("content");

            List<Map<String, Object>> options =
                    (List<Map<String, Object>>) question.get("options");

            List<OptionResponse> optionResponses = new ArrayList<>();

            for (Map<String, Object> option : options) {

                String key = (String) option.get("key");
                String text = (String) option.get("text");

                optionResponses.add(
                        new OptionResponse(key, text)
                );
            }

            QuestionResponse response =
                    new QuestionResponse(
                            number,
                            content,
                            optionResponses
                    );

            questionResponses.add(response);
        }

        // Response cuối cùng trả cho frontend
        Map<String, Object> response = new HashMap<>();

        response.put("partNumber", data.get("partNumber"));
        response.put("title", data.get("title"));
        response.put("questions", questionResponses);

        return response;
    }
}