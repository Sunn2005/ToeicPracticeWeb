import test from "node:test";
import assert from "node:assert/strict";
import { buildOrdersQuery, orderDateEpoch, orderStatusKey, paymentErrorKey, formatOrderAmount, formatOrderDate } from "./adminPayments.js";
import { translations } from "../../i18n/translations.js";

test("query omits empty filters, encodes UID and preserves epoch zero", () => {
  assert.equal(buildOrdersQuery(), "page=0&size=20");
  const query = new URLSearchParams(buildOrdersQuery({ status: "PAID", planCode: "PRO_30", userId: " a/b &c ", from: 0, to: 10 }, 2, 5));
  assert.deepEqual(Object.fromEntries(query), { status: "PAID", planCode: "PRO_30", userId: "a/b &c", from: "0", to: "10", page: "2", size: "5" });
  assert.equal(buildOrdersQuery({ userId: "  ", from: null, to: undefined, status: "", planCode: "" }), "page=0&size=20");
});

test("Vietnam day range includes its first and last millisecond regardless of host timezone", () => {
  assert.equal(orderDateEpoch("2026-10-24"), Date.parse("2026-10-23T17:00:00Z"));
  assert.equal(orderDateEpoch("2026-10-24", true), Date.parse("2026-10-24T16:59:59.999Z"));
  assert.equal(orderDateEpoch(""), null);
  assert.equal(orderDateEpoch("bad-date"), null);
});

test("status and HTTP/code errors map to translated keys", () => {
  for (const [status, suffix] of [["PENDING", "Pending"], ["PAID", "Paid"], ["CANCELLED", "Cancelled"]]) {
    assert.equal(orderStatusKey({ status }), `adminOrders${suffix}`);
  }
  assert.equal(orderStatusKey(null), "adminOrdersUnknownStatus");
  for (const [status, suffix] of [[401, "AuthError"], [403, "AccessError"], [404, "NotFoundError"], [500, "RequestError"]]) {
    assert.equal(paymentErrorKey({ status }), `adminOrders${suffix}`);
  }
  assert.equal(paymentErrorKey({ status: 400, body: { code: "PAYMENT_ORDER_FILTER_INVALID" } }), "adminOrdersFilterError");
  assert.equal(paymentErrorKey(null), "adminOrdersRequestError");
});

test("formatters handle missing dates and display VND and Vietnam time", () => {
  assert.equal(formatOrderDate(null, "vi"), "—");
  assert.match(formatOrderDate(Date.parse("2026-10-23T17:00:00Z"), "en"), /10\/24\/2026/);
  assert.match(formatOrderAmount(1000, "en"), /1,000/);
});

test("all new translations exist in both languages", () => {
  const keys = Object.keys(translations.en).filter((key) => key.startsWith("adminOrders"));
  assert.ok(keys.length > 30);
  assert.deepEqual(keys.sort(), Object.keys(translations.vi).filter((key) => key.startsWith("adminOrders")).sort());
  for (const key of keys) assert.ok(translations.en[key] && translations.vi[key]);
});

test("reconciliation errors use stable codes and translated recovery messages", () => {
  for (const [code, key] of Object.entries({
    PAYMENT_ORDER_CANCELLED: "adminOrdersReconcileCancelled",
    PAYMENT_ORDER_MISMATCH: "adminOrdersReconcileMismatch",
    PAYMENT_NOT_PAID: "adminOrdersReconcileUnpaid",
    PAYOS_UNAVAILABLE: "adminOrdersReconcileUnavailable",
  })) {
    assert.equal(paymentErrorKey({ status: code === "PAYOS_UNAVAILABLE" ? 502 : 409, body: { code } }), key);
    assert.ok(translations.en[key] && translations.vi[key]);
  }
});
