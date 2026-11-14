import { orderDateEpoch } from "./adminPayments.js";

export function buildRevenueQuery({ from, to, granularity = "day" } = {}) {
  const query = new URLSearchParams();
  const fromEpoch = orderDateEpoch(from);
  const toEpoch = orderDateEpoch(to, true);
  if (fromEpoch !== null) query.set("from", fromEpoch);
  if (toEpoch !== null) query.set("to", toEpoch);
  query.set("granularity", granularity);
  return query.toString();
}

export function revenuePresets() {
  return [{ key: "7d" }, { key: "30d" }, { key: "month" }, { key: "custom" }];
}

export function revenueErrorKey(error) {
  if (error?.status === 401) return "adminRevenueAuthError";
  if (error?.status === 403) return "adminRevenueAccessError";
  if (error?.body?.code === "PAYMENT_REVENUE_FILTER_INVALID") return "adminRevenueFilterError";
  return "adminRevenueRequestError";
}
