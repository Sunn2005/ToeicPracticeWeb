package com.toeic.service;

import com.toeic.config.PayOSProperties;
import com.toeic.controller.ApiCodeException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;

/**
 * Minimal PayOS client (no official Java SDK): creates payment links and verifies
 * webhook signatures. Signatures follow PayOS's documented scheme: sort fields
 * alphabetically, join as {@code key=value} with {@code &}, HMAC-SHA256 hex
 * with the checksum key.
 */
@Service
public class PayOSClient {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final PayOSProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public PayOSClient(PayOSProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, HttpClient.newBuilder().connectTimeout(TIMEOUT).build());
    }

    PayOSClient(PayOSProperties properties, ObjectMapper objectMapper, HttpClient httpClient) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    public record PaymentLink(String checkoutUrl, String paymentLinkId) { }

    public record PaymentInfo(long orderCode, String paymentLinkId, long amount,
                              long amountPaid, long amountRemaining, String status) { }

    /** Read-only provider lookup; never accept payment status from a browser redirect. */
    public PaymentInfo getPaymentInfo(long orderCode) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(properties.getBaseUrl() + "/v2/payment-requests/" + orderCode))
                    .timeout(TIMEOUT)
                    .header("x-client-id", properties.getClientId())
                    .header("x-api-key", properties.getApiKey())
                    .GET().build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Unsuccessful provider response");
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode data = root.path("data");
            if (!"00".equals(root.path("code").asText()) || !data.isObject()
                    || !data.path("id").isString() || data.path("id").asText().isBlank()
                    || !data.path("status").isString()) {
                throw new IllegalStateException("Invalid provider response");
            }
            return new PaymentInfo(requiredLong(data, "orderCode"), data.path("id").asText(),
                    requiredLong(data, "amount"), requiredLong(data, "amountPaid"),
                    requiredLong(data, "amountRemaining"), data.path("status").asText());
        } catch (Exception exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            // Do not expose provider response bodies, credentials or bank details.
            throw new ApiCodeException(HttpStatus.BAD_GATEWAY, "PAYOS_UNAVAILABLE",
                    "PayOS payment information is unavailable");
        }
    }

    private static long requiredLong(JsonNode data, String field) {
        JsonNode value = data.path(field);
        if (!value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() < 0) {
            throw new IllegalStateException("Invalid provider numeric field");
        }
        return value.longValue();
    }

    public PaymentLink createPaymentLink(long orderCode, long amount, String description) throws Exception {
        Map<String, Object> body = new TreeMap<>();
        body.put("orderCode", orderCode);
        body.put("amount", amount);
        body.put("description", description);
        body.put("returnUrl", properties.getReturnUrl());
        body.put("cancelUrl", properties.getCancelUrl());
        body.put("signature", sign(body));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(properties.getBaseUrl() + "/v2/payment-requests"))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .header("x-client-id", properties.getClientId())
                .header("x-api-key", properties.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode root = objectMapper.readTree(response.body());
        if (!"00".equals(root.path("code").asText())) {
            throw new ApiCodeException(HttpStatus.BAD_GATEWAY, "PAYOS_UNAVAILABLE",
                    "PayOS could not create a payment link: " + root.path("desc").asText("unknown error"));
        }
        JsonNode data = root.path("data");
        return new PaymentLink(data.path("checkoutUrl").asText(), data.path("paymentLinkId").asText());
    }

    /**
     * Verifies a webhook's {@code signature} over its {@code data} object.
     * Uses a constant-time comparison so a wrong signature leaks nothing via timing.
     */
    public boolean verifyWebhookSignature(Map<String, Object> data, String signature) {
        if (data == null || signature == null) {
            return false;
        }
        String expected = sign(data);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8));
    }

    /** Canonical string: keys sorted alphabetically, {@code key=value} joined by {@code &}. */
    static String canonicalString(Map<String, Object> fields) {
        var sorted = new TreeMap<String, Object>(fields);
        var joined = new StringBuilder();
        for (var entry : sorted.entrySet()) {
            if (!joined.isEmpty()) {
                joined.append('&');
            }
            joined.append(entry.getKey()).append('=').append(stringValue(entry.getValue()));
        }
        return joined.toString();
    }

    private static String stringValue(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Number number) {
            // PayOS signs amounts as plain integers, never "99000.0".
            return number instanceof Double || number instanceof Float
                    ? String.valueOf(number.longValue())
                    : String.valueOf(number);
        }
        return String.valueOf(value);
    }

    String sign(Map<String, Object> fields) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(properties.getChecksumKey().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(canonicalString(fields).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign PayOS payload", exception);
        }
    }
}
