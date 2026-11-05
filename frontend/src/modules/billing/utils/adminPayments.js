// Date inputs always represent Vietnam calendar days, independent of the browser timezone.
export function orderDateEpoch(value, endOfDay = false) {
  if (!value) return null;
  const epoch = Date.parse(`${value}T00:00:00+07:00`);
  return Number.isFinite(epoch) ? epoch + (endOfDay ? 86_400_000 - 1 : 0) : null;
}

export function buildOrdersQuery({ status, planCode, userId, from, to } = {}, page = 0, size = 20) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ status, planCode, userId: userId?.trim(), from, to })) {
    if (value !== undefined && value !== null && value !== "") query.set(key, value);
  }
  query.set("page", page);
  query.set("size", size);
  return query.toString();
}

export function orderStatusKey(order) {
  return { PENDING: "adminOrdersPending", PAID: "adminOrdersPaid", CANCELLED: "adminOrdersCancelled" }[order?.status] || "adminOrdersUnknownStatus";
}

export function paymentErrorKey(error) {
  if (error?.status === 401) return "adminOrdersAuthError";
  if (error?.status === 403) return "adminOrdersAccessError";
  if (error?.status === 404) return "adminOrdersNotFoundError";
  const reconciliationErrors = {
    PAYMENT_ORDER_CANCELLED: "adminOrdersReconcileCancelled",
    PAYMENT_ORDER_MISMATCH: "adminOrdersReconcileMismatch",
    PAYMENT_NOT_PAID: "adminOrdersReconcileUnpaid",
    PAYOS_UNAVAILABLE: "adminOrdersReconcileUnavailable",
  };
  if (reconciliationErrors[error?.body?.code]) return reconciliationErrors[error.body.code];
  if (error?.body?.code === "PAYMENT_ORDER_FILTER_INVALID") return "adminOrdersFilterError";
  return "adminOrdersRequestError";
}

export function formatOrderDate(epoch, language) {
  return epoch == null ? "—" : new Date(epoch).toLocaleString(language === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh" });
}

export function formatOrderAmount(amount, language) {
  return new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "currency", currency: "VND" }).format(amount);
}
