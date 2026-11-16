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

export function previousRevenueRange(from, to, granularity) {
  const first = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  if (!(first <= last)) return null;

  const day = 86_400_000;
  if (granularity === "month") {
    const months = (last.getUTCFullYear() - first.getUTCFullYear()) * 12
      + last.getUTCMonth() - first.getUTCMonth() + 1;
    first.setUTCDate(1);
    last.setTime(first.getTime() - day);
    first.setUTCMonth(first.getUTCMonth() - months);
  } else {
    const length = last.getTime() - first.getTime() + day;
    last.setTime(first.getTime() - day);
    first.setTime(first.getTime() - length);
  }

  const range = { from: first.toISOString().split("T")[0], to: last.toISOString().split("T")[0] };
  return orderDateEpoch(range.from) === null || first.getUTCFullYear() < 1 ? null : range;
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
