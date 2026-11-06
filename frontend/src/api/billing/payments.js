import { apiFetch } from "../client.js";

export function getProPlans() {
  return apiFetch("/api/payments/pro/plans");
}

export function createProPayment(planCode) {
  return apiFetch("/api/payments/pro", {
    method: "POST",
    body: JSON.stringify({ planCode }),
  });
}

export function getPaymentState(orderCode) {
  return apiFetch(`/api/payments/orders/${encodeURIComponent(orderCode)}`);
}

export function retryPayment(orderCode) {
  return apiFetch(`/api/payments/orders/${encodeURIComponent(orderCode)}/retry`, { method: "POST" });
}
