package com.toeic.controller.billing;

import com.toeic.security.ToeicUserPrincipal;
import com.toeic.service.billing.PaymentService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    public List<PaymentService.PlanOption> plans(@AuthenticationPrincipal ToeicUserPrincipal principal) throws Exception {
        return paymentService.availablePlans(principal.uid());
    }

    @PostMapping("/pro")
    public PaymentService.CreatePaymentResult create(
            @AuthenticationPrincipal ToeicUserPrincipal principal,
            @RequestBody CreatePaymentRequest request
    ) throws Exception {
        return paymentService.createProPayment(principal.uid(), request.planCode());
    }

    @GetMapping("/orders/{orderCode}")
    public PaymentService.OrderState state(@AuthenticationPrincipal ToeicUserPrincipal principal,
            @PathVariable long orderCode) throws Exception {
        return paymentService.orderState(principal.uid(), orderCode);
    }

    @PostMapping("/orders/{orderCode}/retry")
    public PaymentService.CreatePaymentResult retry(@AuthenticationPrincipal ToeicUserPrincipal principal,
            @PathVariable long orderCode) throws Exception {
        return paymentService.retryPayment(principal.uid(), orderCode);
    }

    @PostMapping("/orders/{orderCode}/confirm")
    public PaymentService.OrderState confirm(@AuthenticationPrincipal ToeicUserPrincipal principal,
            @PathVariable long orderCode) throws Exception {
        return paymentService.confirmPayment(principal.uid(), orderCode);
    }

    /**
     * PayOS webhook. Public (no session auth) — authenticity comes from the
     * PayOS signature, verified inside {@link PaymentService}. The browser
     * redirect to returnUrl is display-only; confirmation uses server-side PayOS data.
     */
    @PostMapping("/webhook")
    public PaymentService.WebhookResult webhook(@RequestBody Map<String, Object> payload) throws Exception {
        return paymentService.handleWebhook(payload);
    }

    public record CreatePaymentRequest(String planCode) { }
}
