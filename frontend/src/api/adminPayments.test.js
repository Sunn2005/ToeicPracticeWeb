import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { API_BASE_URL } from "./client.js";
import { getAdminOrder, getAdminOrders } from "./adminPayments.js";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("order reads use authenticated GET, query and cancellation signal", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ items: [] }), { headers: { "Content-Type": "application/json" } });
  };
  const signal = new AbortController().signal;
  await getAdminOrders("status=PAID&page=0&size=20", { signal });
  await getAdminOrder(123, { signal });
  assert.equal(calls[0].url, `${API_BASE_URL}/api/admin/payments/orders?status=PAID&page=0&size=20`);
  assert.equal(calls[1].url, `${API_BASE_URL}/api/admin/payments/orders/123`);
  for (const { options } of calls) {
    assert.equal(options.method, "GET");
    assert.equal(options.credentials, "include");
    assert.equal(options.signal, signal);
    assert.equal(options.body, undefined);
  }
});

test("order lookup preserves HTTP errors and stable code", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: "PAYMENT_ORDER_NOT_FOUND" }), { status: 404, headers: { "Content-Type": "application/json" } });
  await assert.rejects(getAdminOrder(404), (error) => error.status === 404 && error.body.code === "PAYMENT_ORDER_NOT_FOUND");
});
