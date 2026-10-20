import { apiFetch } from "./client.js";

export function getProPlans() {
  return apiFetch("/api/payments/pro/plans");
}

export function createProPayment(planCode) {
  return apiFetch("/api/payments/pro", {
    method: "POST",
    body: JSON.stringify({ planCode }),
  });
}
