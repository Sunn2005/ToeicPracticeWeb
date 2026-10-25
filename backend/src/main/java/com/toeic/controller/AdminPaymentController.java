package com.toeic.controller;

import com.toeic.service.AdminPaymentService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {
    private final AdminPaymentService service;

    public AdminPaymentController(AdminPaymentService service) {
        this.service = service;
    }

    @GetMapping("/orders")
    public AdminPaymentService.AdminOrderPage list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String planCode,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) throws Exception {
        return service.listOrders(status, planCode, userId, from, to, page, size);
    }

    @GetMapping("/orders/{orderCode}")
    public AdminPaymentService.AdminOrderView get(@PathVariable long orderCode) throws Exception {
        return service.getOrder(orderCode);
    }
}
