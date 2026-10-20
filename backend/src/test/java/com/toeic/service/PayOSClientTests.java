package com.toeic.service;

import com.toeic.config.PayOSProperties;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PayOSClientTests {
    private final PayOSProperties properties = properties("checksum-key");
    private final PayOSClient client = new PayOSClient(properties, new ObjectMapper());

    @Test
    void canonicalStringSortsKeysAlphabetically() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("returnUrl", "https://example.test/ok");
        fields.put("amount", 99_000);
        fields.put("orderCode", 123L);
        fields.put("description", "CapyTOEIC Pro 30 days");
        fields.put("cancelUrl", "https://example.test/cancel");
        assertEquals("amount=99000&cancelUrl=https://example.test/cancel"
                        + "&description=CapyTOEIC Pro 30 days&orderCode=123"
                        + "&returnUrl=https://example.test/ok",
                PayOSClient.canonicalString(fields));
    }

    @Test
    void webhookSignatureRoundTripsAndRejectsTampering() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderCode", 123L);
        data.put("amount", 99_000);
        data.put("code", "00");
        String signature = client.sign(data);
        assertTrue(client.verifyWebhookSignature(data, signature));
        data.put("amount", 1);
        assertFalse(client.verifyWebhookSignature(data, signature));
        assertFalse(client.verifyWebhookSignature(data, "deadbeef"));
        assertFalse(client.verifyWebhookSignature(data, null));
    }

    @Test
    void signatureDependsOnChecksumKey() {
        Map<String, Object> data = Map.of("orderCode", 123L, "amount", 99_000);
        String signature = client.sign(data);
        var otherClient = new PayOSClient(properties("other-key"), new ObjectMapper());
        assertFalse(otherClient.verifyWebhookSignature(data, signature));
    }

    private static PayOSProperties properties(String checksumKey) {
        var props = new PayOSProperties();
        props.setChecksumKey(checksumKey);
        return props;
    }
}
