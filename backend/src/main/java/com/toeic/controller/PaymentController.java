package com.toeic.controller;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.PaymentService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {
    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/pro/plans")
    public List<PaymentService.PlanOption> plans(@AuthenticationPrincipal ToeicUserPrincipal principal) {
        return paymentService.availablePlans();
    }

    @PostMapping("/pro")
    public PaymentService.CreatePaymentResult create(
            @AuthenticationPrincipal ToeicUserPrincipal principal,
            @RequestBody CreatePaymentRequest request
    ) throws Exception {
        return paymentService.createProPayment(principal.uid(), request.planCode());
    }

    /**
     * PayOS webhook. Public (no session auth) — authenticity comes from the
     * PayOS signature, verified inside {@link PaymentService}. Only the webhook
     * activates Pro; the browser redirect to returnUrl is display-only.
     */
    @PostMapping("/webhook")
    public PaymentService.WebhookResult webhook(@RequestBody Map<String, Object> payload) throws Exception {
        return paymentService.handleWebhook(payload);
    }

    public record CreatePaymentRequest(String planCode) { }
}
