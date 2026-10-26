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

    @Test
    @SuppressWarnings("unchecked")
    void lookupUsesAuthenticatedGetAndParsesExactAmounts() throws Exception {
        var http = org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        java.net.http.HttpResponse<String> response = org.mockito.Mockito.mock(java.net.http.HttpResponse.class);
        org.mockito.Mockito.when(response.statusCode()).thenReturn(200);
        org.mockito.Mockito.when(response.body()).thenReturn("""
                {"code":"00","data":{"id":"link-123","orderCode":5037922063926303,
                "amount":10000,"amountPaid":10000,"amountRemaining":0,"status":"PAID"}}
                """);
        org.mockito.Mockito.doReturn(response).when(http).send(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        var config = properties("checksum");
        config.setClientId("test-client");
        config.setApiKey("test-key");
        var lookup = new PayOSClient(config, new ObjectMapper(), http);
        var info = lookup.getPaymentInfo(5037922063926303L);
        assertEquals(5037922063926303L, info.orderCode());
        assertEquals(10000, info.amountPaid());
        assertEquals("PAID", info.status());
        var capture = org.mockito.ArgumentCaptor.forClass(java.net.http.HttpRequest.class);
        org.mockito.Mockito.verify(http).send(capture.capture(), org.mockito.ArgumentMatchers.any());
        assertEquals("GET", capture.getValue().method());
        assertEquals("https://api-merchant.payos.vn/v2/payment-requests/5037922063926303", capture.getValue().uri().toString());
        assertEquals("test-client", capture.getValue().headers().firstValue("x-client-id").orElseThrow());
        assertEquals("test-key", capture.getValue().headers().firstValue("x-api-key").orElseThrow());
        assertEquals(java.time.Duration.ofSeconds(10), capture.getValue().timeout().orElseThrow());
    }

    @Test
    @SuppressWarnings("unchecked")
    void lookupRejectsHttpErrorsMalformedAndIncompleteProviderData() throws Exception {
        var http = org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        java.net.http.HttpResponse<String> response = org.mockito.Mockito.mock(java.net.http.HttpResponse.class);
        org.mockito.Mockito.doReturn(response).when(http).send(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        var lookup = new PayOSClient(properties("checksum"), new ObjectMapper(), http);
        for (String body : java.util.List.of("not-json", "null", "{}", "{\"code\":\"01\"}",
                "{\"code\":\"00\",\"data\":{\"id\":\"link\",\"status\":\"PAID\"}}",
                "{\"code\":\"00\",\"data\":{\"id\":\"link\",\"status\":\"PAID\",\"orderCode\":1,\"amount\":1.5,\"amountPaid\":2,\"amountRemaining\":0}}")) {
            org.mockito.Mockito.when(response.statusCode()).thenReturn(200);
            org.mockito.Mockito.when(response.body()).thenReturn(body);
            var error = assertThrows(com.toeic.controller.ApiCodeException.class, () -> lookup.getPaymentInfo(1));
            assertEquals("PAYOS_UNAVAILABLE", error.getCode());
        }
        org.mockito.Mockito.when(response.statusCode()).thenReturn(401);
        assertEquals("PAYOS_UNAVAILABLE", assertThrows(com.toeic.controller.ApiCodeException.class,
                () -> lookup.getPaymentInfo(1)).getCode());
        org.mockito.Mockito.doThrow(new java.net.http.HttpTimeoutException("Timeout"))
                .when(http).send(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        assertEquals("PAYOS_UNAVAILABLE", assertThrows(com.toeic.controller.ApiCodeException.class,
                () -> lookup.getPaymentInfo(1)).getCode());
    }

    private static PayOSProperties properties(String checksumKey) {
        var props = new PayOSProperties();
        props.setChecksumKey(checksumKey);
        return props;
    }
}
