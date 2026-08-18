package com.toeic.service;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import com.google.firebase.FirebaseApp;
import com.google.firebase.cloud.StorageClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaStorageService {

    private static final long MAX_FILE_SIZE = 15L * 1024L * 1024L;
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "audio/mpeg",
            "audio/mp4",
            "audio/wav",
            "audio/x-wav",
            "audio/ogg"
    );

    private final FirebaseApp firebaseApp;
    private final String storageBucket;

    public MediaStorageService(
            FirebaseApp firebaseApp,
            @Value("${firebase.storage-bucket:}") String storageBucket
    ) {
        this.firebaseApp = firebaseApp;
        this.storageBucket = storageBucket;
    }

    public Map<String, Object> upload(String employeeUid, MultipartFile file) throws Exception {
        validate(file);
        if (storageBucket == null || storageBucket.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Chưa cấu hình biến FIREBASE_STORAGE_BUCKET"
            );
        }

        String originalName = file.getOriginalFilename() == null ? "media" : file.getOriginalFilename();
        String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "-");
        String objectName = "toeic-media/" + employeeUid + "/" + UUID.randomUUID() + "-" + safeName;
        String downloadToken = UUID.randomUUID().toString();
        Bucket bucket = StorageClient.getInstance(firebaseApp).bucket(storageBucket);
        Blob blob = bucket.create(objectName, file.getBytes(), file.getContentType());
        blob = blob.toBuilder()
                .setMetadata(Map.of("firebaseStorageDownloadTokens", downloadToken))
                .build()
                .update();

        String encodedObjectName = URLEncoder.encode(objectName, StandardCharsets.UTF_8)
                .replace("+", "%20");
        String url = "https://firebasestorage.googleapis.com/v0/b/"
                + bucket.getName()
                + "/o/"
                + encodedObjectName
                + "?alt=media&token="
                + downloadToken;

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("url", url);
        response.put("objectName", blob.getName());
        response.put("fileName", originalName);
        response.put("contentType", file.getContentType());
        response.put("size", file.getSize());
        return response;
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File tải lên không được để trống");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File không được vượt quá 15 MB");
        }
        if (file.getContentType() == null || !ALLOWED_TYPES.contains(file.getContentType())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Chỉ hỗ trợ file ảnh JPEG, PNG, WEBP, GIF hoặc audio MP3, MP4, WAV, OGG"
            );
        }
    }
}
