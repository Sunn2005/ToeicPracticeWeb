package com.toeic.security;

import com.toeic.config.AuthProperties;
import com.toeic.model.User;
import com.toeic.service.CurrentUserService;
import com.toeic.service.FirebaseSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.WebUtils;

import java.io.IOException;
import java.util.ArrayList;
import com.toeic.service.StaffAccessService;
import com.toeic.model.enums.UserRole;

@Component
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTH_PATH_PREFIX = "/api/v1/auth/";

    private final CurrentUserService currentUserService;
    private final StaffAccessService staffAccessService;
    private final FirebaseSessionService firebaseSessionService;
    private final AuthProperties authProperties;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;

    public FirebaseAuthenticationFilter(
            CurrentUserService currentUserService,
            StaffAccessService staffAccessService,
            FirebaseSessionService firebaseSessionService,
            AuthProperties authProperties,
            RestAuthenticationEntryPoint authenticationEntryPoint
    ) {
        this.currentUserService = currentUserService;
        this.staffAccessService = staffAccessService;
        this.firebaseSessionService = firebaseSessionService;
        this.authProperties = authProperties;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Authentication recovery endpoints must remain reachable when an old
        // session cookie is expired or revoked. CSRF protection still runs in
        // Spring Security and protects the unsafe session/logout requests.
        return request.getRequestURI().startsWith(AUTH_PATH_PREFIX);
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

        var sessionCookie = WebUtils.getCookie(request, authProperties.getCookieName());
        if (sessionCookie == null || sessionCookie.getValue().isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            var identity = firebaseSessionService.verifySession(sessionCookie.getValue());
            User user = currentUserService.requireUser(identity);
            ToeicUserPrincipal principal = ToeicUserPrincipal.from(user);
            var authorities = new ArrayList<SimpleGrantedAuthority>();
            if (user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.EMPLOYEE) {
                var access = staffAccessService.forUser(user);
                authorities.add(new SimpleGrantedAuthority(access.active() ? "ROLE_" + principal.role().name() : "ROLE_USER"));
                access.permissions().forEach(permission -> authorities.add(new SimpleGrantedAuthority(permission)));
            } else {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + principal.role().name()));
            }
            var authentication = new ToeicAuthenticationToken(principal, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (ResponseStatusException exception) {
            SecurityContextHolder.clearContext();
            if (exception.getStatusCode().value() == HttpServletResponse.SC_SERVICE_UNAVAILABLE) {
                authenticationEntryPoint.writeError(
                        request,
                        response,
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "FIREBASE_AUTH_UNAVAILABLE",
                        "Dịch vụ xác thực tạm thời không khả dụng"
                );
                return;
            }
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
