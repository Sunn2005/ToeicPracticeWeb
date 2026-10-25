package com.toeic.controller;

import com.toeic.dao.PaymentOrderDao;
import com.toeic.dao.UserDao;
import com.toeic.model.PaymentOrder;
import com.toeic.service.AdminPaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminPaymentControllerTests {
    private PaymentOrderDao orders;
    private MockMvc mvc;

    @Configuration
    @EnableMethodSecurity
    static class Config {
        @Bean PaymentOrderDao orders() { return mock(PaymentOrderDao.class); }
        @Bean UserDao users() { return mock(UserDao.class); }
        @Bean AdminPaymentService service(PaymentOrderDao orders, UserDao users) {
            return new AdminPaymentService(orders, users);
        }
        @Bean AdminPaymentController controller(AdminPaymentService service) {
            return new AdminPaymentController(service);
        }
    }

    // Standalone MVC needs an exception mapping; authorization itself uses real method security.
    @RestControllerAdvice
    static class SecurityErrors {
        @ExceptionHandler(AccessDeniedException.class)
        ResponseEntity<Void> denied() { return ResponseEntity.status(403).build(); }
    }

    @BeforeEach
    void setUp() throws Exception {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            orders = context.getBean(PaymentOrderDao.class);
            mvc = MockMvcBuilders.standaloneSetup(context.getBean(AdminPaymentController.class))
                    .setControllerAdvice(new ApiExceptionHandler(), new SecurityErrors()).build();
        }
        PaymentOrder order = new PaymentOrder();
        order.setOrderCode(123);
        order.setCheckoutUrl("https://example.com/live-checkout");
        when(orders.findAll()).thenReturn(List.of(order));
        when(orders.findByOrderCode(123)).thenReturn(Optional.of(order));
    }

    @org.junit.jupiter.api.AfterEach
    void clearSecurity() { SecurityContextHolder.clearContext(); }

    private void role(String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("verified-user", null,
                        AuthorityUtils.createAuthorityList("ROLE_" + role)));
    }

    @Test
    void nonAdminCannotReadEitherEndpoint() throws Exception {
        for (String role : List.of("USER", "EMPLOYEE")) {
            role(role);
            mvc.perform(get("/api/admin/payments/orders")).andExpect(status().isForbidden());
            mvc.perform(get("/api/admin/payments/orders/123")).andExpect(status().isForbidden());
        }
        verifyNoInteractions(orders);
    }

    @Test
    void adminCanReadListAndDetailWithoutCheckoutUrl() throws Exception {
        role("ADMIN");
        mvc.perform(get("/api/admin/payments/orders"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].orderCode").value(123))
                .andExpect(jsonPath("$.items[0].checkoutUrl").doesNotExist())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(20));
        mvc.perform(get("/api/admin/payments/orders/123"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.orderCode").value(123))
                .andExpect(jsonPath("$.checkoutUrl").doesNotExist());
    }

    @Test
    void businessErrorsKeepStatusAndCode() throws Exception {
        role("ADMIN");
        mvc.perform(get("/api/admin/payments/orders").param("status", "BAD"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYMENT_ORDER_FILTER_INVALID"));
        mvc.perform(get("/api/admin/payments/orders/404"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PAYMENT_ORDER_NOT_FOUND"));
    }
}
