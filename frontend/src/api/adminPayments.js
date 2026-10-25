import { apiFetch } from "./client.js";

export function getAdminOrders(query, options) {
  return apiFetch(`/api/admin/payments/orders?${query}`, options);
}

export function getAdminOrder(orderCode, options) {
  return apiFetch(`/api/admin/payments/orders/${encodeURIComponent(orderCode)}`, options);
}
