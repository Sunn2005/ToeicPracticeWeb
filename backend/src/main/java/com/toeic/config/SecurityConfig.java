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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            FirebaseAuthenticationFilter firebaseFilter,
            RestAuthenticationEntryPoint authenticationEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler
    ) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
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

                        // Chỉ các API đọc catalog đề thi là public.
                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/tests",
                                "/api/tests/*",
                                "/api/tests/*/parts/*"
                        ).permitAll()

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
                                "/api/ai/jobs/**"
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
                "Authorization", "Content-Type", "Accept"
        ));
        configuration.setExposedHeaders(List.of("Location"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
