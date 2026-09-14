package com.toeic.security;

import com.toeic.model.User;
import com.toeic.service.CurrentUserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@Component
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    private final CurrentUserService currentUserService;
    private final AuthenticationEntryPoint authenticationEntryPoint;

    public FirebaseAuthenticationFilter(
            CurrentUserService currentUserService,
            AuthenticationEntryPoint authenticationEntryPoint
    ) {
        this.currentUserService = currentUserService;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || authorization.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            User user = currentUserService.requireUser(authorization);
            ToeicUserPrincipal principal = ToeicUserPrincipal.from(user);
            var authorities = List.of(
                    new SimpleGrantedAuthority("ROLE_" + principal.role().name())
            );
            var authentication = new ToeicAuthenticationToken(principal, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (ResponseStatusException exception) {
            SecurityContextHolder.clearContext();
            authenticationEntryPoint.commence(
                    request,
                    response,
                    new BadCredentialsException(
                            exception.getReason() == null
                                    ? "Firebase ID token không hợp lệ"
                                    : exception.getReason(),
                            exception
                    )
            );
            return;
        } catch (Exception exception) {
            SecurityContextHolder.clearContext();
            throw new ServletException("Không thể xác thực người dùng", exception);
        }

        // Chỉ bọc bước xác thực trong try/catch. Lỗi nghiệp vụ 404/409 phát sinh
        // phía controller/service phải được ApiExceptionHandler xử lý, không được
        // biến thành lỗi 401 của Firebase.
        filterChain.doFilter(request, response);
    }
}
