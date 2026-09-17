package com.toeic.ai_service.config;

import com.google.genai.Client;
import com.google.genai.types.HttpOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class GoogleGenAiConfig {

    @Bean(destroyMethod = "close")
    Client googleGenAiClient(
            @Value("${spring.ai.google.genai.api-key}") String apiKey,
            @Value("${app.ai.review.request-timeout-ms:120000}") int requestTimeoutMs
    ) {
        return Client.builder()
                .apiKey(apiKey)
                .httpOptions(HttpOptions.builder()
                        .timeout(Math.max(1_000, requestTimeoutMs))
                        .build())
                .build();
    }
}
