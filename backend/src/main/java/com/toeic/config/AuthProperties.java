package com.toeic.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "app.auth")
public class AuthProperties {

    private String cookieName = "session";
    private Duration sessionDuration = Duration.ofDays(7);
    private boolean cookieSecure = true;
    private String cookieSameSite = "Lax";

    public AuthProperties() {
    }

    public AuthProperties(
            String cookieName,
            Duration sessionDuration,
            boolean cookieSecure,
            String cookieSameSite
    ) {
        this.cookieName = cookieName;
        this.sessionDuration = sessionDuration;
        this.cookieSecure = cookieSecure;
        this.cookieSameSite = cookieSameSite;
    }

    public String getCookieName() {
        return cookieName;
    }

    public void setCookieName(String cookieName) {
        this.cookieName = cookieName;
    }

    public Duration getSessionDuration() {
        return sessionDuration;
    }

    public void setSessionDuration(Duration sessionDuration) {
        this.sessionDuration = sessionDuration;
    }

    public boolean isCookieSecure() {
        return cookieSecure;
    }

    public void setCookieSecure(boolean cookieSecure) {
        this.cookieSecure = cookieSecure;
    }

    public String getCookieSameSite() {
        return cookieSameSite;
    }

    public void setCookieSameSite(String cookieSameSite) {
        this.cookieSameSite = cookieSameSite;
    }
}
