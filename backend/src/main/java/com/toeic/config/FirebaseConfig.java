package com.toeic.config;

import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Bean
    public FirebaseApp firebaseApp(
            @Value("${firebase.project-id}") String configuredProjectId,
            @Value("${firebase.service-account}") Resource serviceAccountResource,
            @Value("${firebase.storage-bucket:}") String storageBucket
    ) throws IOException {
        if (!serviceAccountResource.exists()) {
            throw new IllegalStateException(
                    "Không tìm thấy Firebase service account: " + serviceAccountResource.getDescription()
            );
        }

        ServiceAccountCredentials credentials;
        try (InputStream inputStream = serviceAccountResource.getInputStream()) {
            credentials = ServiceAccountCredentials.fromStream(inputStream);
        }

        String serviceAccountProjectId = credentials.getProjectId();
        if (!Objects.equals(configuredProjectId, serviceAccountProjectId)) {
            throw new IllegalStateException(
                    "Firebase project không khớp: cấu hình=" + configuredProjectId
                            + ", service account=" + serviceAccountProjectId
            );
        }

        FirebaseApp existingApp = FirebaseApp.getApps().stream()
                .filter(app -> FirebaseApp.DEFAULT_APP_NAME.equals(app.getName()))
                .findFirst()
                .orElse(null);

        if (existingApp != null) {
            String currentProjectId = existingApp.getOptions().getProjectId();
            if (!Objects.equals(configuredProjectId, currentProjectId)) {
                throw new IllegalStateException(
                        "FirebaseApp mặc định đã dùng project khác: " + currentProjectId
                );
            }

            log.info("Using existing FirebaseApp name={}, projectId={}",
                    existingApp.getName(), currentProjectId);
            return existingApp;
        }

        FirebaseOptions.Builder optionsBuilder = FirebaseOptions.builder()
                .setCredentials(credentials)
                .setProjectId(configuredProjectId);
        if (storageBucket != null && !storageBucket.isBlank()) {
            optionsBuilder.setStorageBucket(storageBucket);
        }
        FirebaseOptions options = optionsBuilder.build();

        FirebaseApp app = FirebaseApp.initializeApp(options);
        log.info("Initialized FirebaseApp name={}, projectId={}, serviceAccount={}",
                app.getName(), app.getOptions().getProjectId(), serviceAccountResource.getDescription());
        return app;
    }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }

    @Bean
    public Firestore firestore(FirebaseApp firebaseApp) {
        return FirestoreClient.getFirestore(firebaseApp);
    }
}
