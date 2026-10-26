package com.toeic.controller;

import com.toeic.service.AdminPaymentService;
import com.toeic.service.AdminRevenueService;
import com.toeic.service.PaymentService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/payments")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {
    private final AdminPaymentService service;

    private final AdminRevenueService revenueService;
    private final PaymentService paymentService;

    public AdminPaymentController(AdminPaymentService service, AdminRevenueService revenueService,
                                  PaymentService paymentService) {
        this.service = service;
        this.revenueService = revenueService;
        this.paymentService = paymentService;
    }

    @GetMapping("/revenue")
    public AdminRevenueService.RevenueReport revenue(
            @RequestParam(required = false) Long from,
            @RequestParam(required = false) Long to,
            @RequestParam(defaultValue = "day") String granularity) throws Exception {
        return revenueService.getRevenue(from, to, granularity);
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

    @PostMapping("/orders/{orderCode}/reconcile")
    public AdminPaymentService.AdminOrderView reconcile(@PathVariable long orderCode) throws Exception {
        paymentService.reconcile(orderCode);
        return service.getOrder(orderCode);
    }
}
