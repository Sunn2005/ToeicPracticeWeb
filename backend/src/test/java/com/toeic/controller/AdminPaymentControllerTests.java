package com.toeic.controller;

import com.toeic.dao.PaymentOrderDao;
import com.toeic.dao.UserDao;
import com.toeic.model.PaymentOrder;
import com.toeic.service.AdminPaymentService;
import com.toeic.service.AdminRevenueService;
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
        @Bean AdminRevenueService revenueService(PaymentOrderDao orders) {
            return new AdminRevenueService(orders);
        }
        @Bean AdminPaymentController controller(AdminPaymentService service, AdminRevenueService revenueService) {
            return new AdminPaymentController(service, revenueService);
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
            mvc.perform(get("/api/admin/payments/revenue")).andExpect(status().isForbidden());
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
    void adminCanReadRevenueReportWithoutPersonalOrCheckoutData() throws Exception {
        role("ADMIN");
        PaymentOrder paid = new PaymentOrder();
        paid.setOrderCode(456);
        paid.setStatus(com.toeic.model.enums.PaymentOrderStatus.PAID);
        paid.setPlanCode("PRO_30");
        paid.setAmount(99000);
        paid.setCreatedAt(100);
        paid.setPaidAt(200L);
        paid.setUserId("private-user");
        paid.setCheckoutUrl("https://example.com/private");
        when(orders.findAll()).thenReturn(List.of(paid));
        mvc.perform(get("/api/admin/payments/revenue").param("from", "200").param("to", "200"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalRevenue").value(99000))
                .andExpect(jsonPath("$.paidOrderCount").value(1))
                .andExpect(jsonPath("$.totalOrderCount").value(0))
                .andExpect(jsonPath("$.successRate").value(0))
                .andExpect(jsonPath("$.averageOrderValue").value(99000))
                .andExpect(jsonPath("$.byPlan[0].planCode").value("PRO_30"))
                .andExpect(jsonPath("$.series[0].period").value("1970-01-01"))
                .andExpect(jsonPath("$.series[0].revenue").value(99000))
                .andExpect(jsonPath("$.series[0].orders").value(1))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))))
                .andExpect(jsonPath("$.checkoutUrl").doesNotExist());
        mvc.perform(get("/api/admin/payments/revenue").param("granularity", "year"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAYMENT_REVENUE_FILTER_INVALID"));
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
