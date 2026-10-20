package com.toeic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * PayOS credentials come from environment variables (see application.properties).
 * Never commit real keys. The webhook URL itself is registered in the PayOS dashboard.
 */
@Component
@ConfigurationProperties(prefix = "payos")
public class PayOSProperties {
    private String clientId = "";
    private String apiKey = "";
    private String checksumKey = "";
    private String baseUrl = "https://api-merchant.payos.vn";
    private String returnUrl = "http://localhost:5173/payment/success";
    private String cancelUrl = "http://localhost:5173/payment/cancel";

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getChecksumKey() {
        return checksumKey;
    }

    public void setChecksumKey(String checksumKey) {
        this.checksumKey = checksumKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getReturnUrl() {
        return returnUrl;
    }

    public void setReturnUrl(String returnUrl) {
        this.returnUrl = returnUrl;
    }

    public String getCancelUrl() {
        return cancelUrl;
    }

    public void setCancelUrl(String cancelUrl) {
        this.cancelUrl = cancelUrl;
    }
}
