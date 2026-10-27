package com.toeic.config;

import com.toeic.security.FirebaseAuthenticationFilter;
import com.toeic.security.RestAccessDeniedHandler;
import com.toeic.security.RestAuthenticationEntryPoint;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final AuthProperties authProperties;

    public SecurityConfig(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            FirebaseAuthenticationFilter firebaseFilter,
            RestAuthenticationEntryPoint authenticationEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler
    ) throws Exception {
        return http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository())
                        // PayOS posts the webhook without a CSRF token; authenticity
                        // comes from the PayOS signature verified in PaymentService.
                        .ignoringRequestMatchers(request ->
                                HttpMethod.POST.matches(request.getMethod())
                                        && "/api/payments/webhook".equals(request.getRequestURI())))
                .cors(Customizer.withDefaults())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                )
                .authorizeHttpRequests(auth -> auth

                        .requestMatchers(HttpMethod.OPTIONS, "/**")
                        .permitAll()

                        .requestMatchers("/error")
                        .permitAll()

                        .requestMatchers("/api/v1/auth/**")
                        .permitAll()

                        .requestMatchers(HttpMethod.GET, "/api/health")
                        .permitAll()

                        // PayOS webhook is public: authenticity comes from the PayOS
                        // signature, verified inside PaymentService — never from a session.
                        .requestMatchers(HttpMethod.POST, "/api/payments/webhook")
                        .permitAll()

                        // Chỉ các API đọc catalog đề thi là public.
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/tests",
                                "/api/tests/*",
                                "/api/tests/*/parts/*"
                        ).permitAll()

                        .requestMatchers(HttpMethod.GET, "/api/admin/test-submissions", "/api/admin/test-submissions/*")
                        .hasAnyAuthority("ROLE_ADMIN", "reviews.view")

                        .requestMatchers(HttpMethod.POST, "/api/admin/test-submissions/*/approve", "/api/admin/test-submissions/*/reject")
                        .hasAnyAuthority("ROLE_ADMIN", "reviews.edit")

                        .requestMatchers(HttpMethod.GET, "/api/admin/review-history")
                        .hasAnyAuthority("ROLE_ADMIN", "history.view")

                        .requestMatchers(HttpMethod.GET, "/api/admin/payments/revenue")
                        .hasAnyAuthority("ROLE_ADMIN", "revenue.view")

                        .requestMatchers(HttpMethod.GET, "/api/admin/payments/orders", "/api/admin/payments/orders/*")
                        .hasAnyAuthority("ROLE_ADMIN", "orders.view")

                        // Admin
                        .requestMatchers("/api/admin/**")
                        .hasRole("ADMIN")

                        // Employee và Admin
                        .requestMatchers("/api/employee/**")
                        .hasAnyRole("EMPLOYEE", "ADMIN")

                        // Endpoint kiểm thử chỉ tồn tại khi được bật bằng cấu hình.
                        .requestMatchers("/api/internal/**")
                        .hasRole("ADMIN")

                        // Các endpoint còn lại cần đăng nhập
                        .requestMatchers(
                                "/api/me",
                                "/api/users/me/**",
                                "/api/attempts/**",
                                "/api/ai/jobs/**",
                                "/api/ai/chat/**",
                                "/api/payments/**"
                        ).authenticated()

                        // Tạo attempt cũng cần đăng nhập
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/tests/*/attempts"
                        ).authenticated()

                        .anyRequest().denyAll()
                )
                .addFilterBefore(
                        firebaseFilter,
                        UsernamePasswordAuthenticationFilter.class
                )
                .build();
    }

    private CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(cookie -> cookie
                .secure(authProperties.isCookieSecure())
                .sameSite(authProperties.getCookieSameSite())
                .path("/"));
        return repository;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of(
                "http://localhost:5173",
                "https://*.vercel.app",
                "https://capytoeic.id.vn",
                "https://www.capytoeic.id.vn"
        ));
        configuration.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"
        ));
        configuration.setAllowedHeaders(List.of(
                "Content-Type", "Accept", "X-XSRF-TOKEN"
        ));
        configuration.setExposedHeaders(List.of("Location"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
