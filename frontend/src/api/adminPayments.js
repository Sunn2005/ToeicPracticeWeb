import { apiFetch } from "./client.js";

export function getAdminOrders(query, options) {
  return apiFetch(`/api/admin/payments/orders?${query}`, options);
}

export function getAdminOrder(orderCode, options) {
  return apiFetch(`/api/admin/payments/orders/${encodeURIComponent(orderCode)}`, options);
}

export function reconcileAdminOrder(orderCode, options) {
  return apiFetch(`/api/admin/payments/orders/${encodeURIComponent(orderCode)}/reconcile`, {
    ...options,
    method: "POST",
  });
}

export function getAdminRevenue(query, options) {
  return apiFetch(`/api/admin/payments/revenue?${query}`, options);
}
