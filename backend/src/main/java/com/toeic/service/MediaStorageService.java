package com.toeic.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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

    private static final String BUCKET = "toeic-media";
    private final String supabaseUrl;
    private final String serviceKey;
    private final HttpClient httpClient;

    @Autowired
    public MediaStorageService(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-key:}") String serviceKey
    ) {
        this(supabaseUrl, serviceKey, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .version(HttpClient.Version.HTTP_1_1)
                .followRedirects(HttpClient.Redirect.NEVER)
                .build());
    }

    MediaStorageService(String supabaseUrl, String serviceKey, HttpClient httpClient) {
        this.supabaseUrl = supabaseUrl == null ? "" : supabaseUrl.trim().replaceAll("/+$", "");
        this.serviceKey = serviceKey == null ? "" : serviceKey.trim();
        this.httpClient = httpClient;
    }

    public Map<String, Object> upload(String employeeUid, MultipartFile file) throws IOException {
        validate(file);
        validateConfiguration();

        String originalName = file.getOriginalFilename() == null ? "media" : file.getOriginalFilename();
        String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "-");
        // objectName is relative to the bucket; each upload gets a new object (no overwrite).
        String storedName = UUID.randomUUID() + "-" + safeName;
        String objectName = employeeUid + "/" + storedName;
        String objectPath = encodeSegment(employeeUid) + "/" + encodeSegment(storedName);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(supabaseUrl + "/storage/v1/object/" + BUCKET + "/" + objectPath))
                .timeout(Duration.ofSeconds(60))
                .header("apikey", serviceKey)
                .header("Authorization", "Bearer " + serviceKey)
                .header("Content-Type", file.getContentType())
                .header("x-upsert", "false")
                .POST(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                .build();

        try {
            HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw storageUnavailable();
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw storageUnavailable();
        } catch (IOException exception) {
            // Do not expose upstream bodies, headers or exceptions containing credentials.
            throw storageUnavailable();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("url", supabaseUrl + "/storage/v1/object/public/" + BUCKET + "/" + objectPath);
        response.put("objectName", objectName);
        response.put("fileName", originalName);
        response.put("contentType", file.getContentType());
        response.put("size", file.getSize());
        return response;
    }

    private void validateConfiguration() {
        try {
            URI uri = URI.create(supabaseUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                    || uri.getRawFragment() != null || !uri.getPath().isEmpty()
                    || serviceKey.isBlank() || serviceKey.contains("\r") || serviceKey.contains("\n")) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Chưa cấu hình hợp lệ SUPABASE_URL và SUPABASE_SERVICE_KEY");
        }
    }

    private static String encodeSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static ResponseStatusException storageUnavailable() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Không thể tải media lên storage, vui lòng thử lại sau");
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
