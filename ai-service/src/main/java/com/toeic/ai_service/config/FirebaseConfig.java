package com.toeic.ai_service.config;

import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

import java.io.InputStream;
import java.util.Objects;

@Configuration
public class FirebaseConfig {

    @Bean
    FirebaseApp firebaseApp(
            @Value("${firebase.project-id}") String projectId,
            @Value("${firebase.service-account}") Resource serviceAccount
    ) throws Exception {
        if (!serviceAccount.exists()) {
            throw new IllegalStateException("Không tìm thấy Firebase service account");
        }
        ServiceAccountCredentials credentials;
        try (InputStream input = serviceAccount.getInputStream()) {
            credentials = ServiceAccountCredentials.fromStream(input);
        }
        if (!Objects.equals(projectId, credentials.getProjectId())) {
            throw new IllegalStateException("Firebase project không khớp với service account");
        }
        String appName = "toeic-ai-service";
        return FirebaseApp.getApps().stream()
                .filter(app -> appName.equals(app.getName()))
                .findFirst()
                .orElseGet(() -> FirebaseApp.initializeApp(
                        FirebaseOptions.builder()
                                .setCredentials(credentials)
                                .setProjectId(projectId)
                                .build(),
                        appName
                ));
    }

    @Bean
    Firestore firestore(FirebaseApp firebaseApp) {
        return FirestoreClient.getFirestore(firebaseApp);
    }
}
