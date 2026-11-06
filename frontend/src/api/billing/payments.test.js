import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { API_BASE_URL, clearCsrfToken } from "../client.js";
import { createProPayment, getProPlans, getPaymentState, retryPayment } from "./payments.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
});

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installResponses(...responses) {
  const calls = [];
  let index = 0;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return responses[Math.min(index++, responses.length - 1)];
  };
  return calls;
}

test("pro plans are fetched from the payments endpoint", async () => {
  const plans = [{ planCode: "PRO_30", amount: 99000, durationDays: 30, trial: false, trialUsed: false }];
  const calls = installResponses(json(plans));

  assert.deepEqual(await getProPlans(), plans);
  assert.equal(calls[0].url, `${API_BASE_URL}/api/payments/pro/plans`);
  assert.equal(calls[0].options.credentials, "include");
});

test("creating a pro payment posts only the plan code", async () => {
  const result = { checkoutUrl: "https://payos.test/checkout/1", orderCode: 1 };
  const calls = installResponses(json({ token: "csrf" }), json(result));

  assert.deepEqual(await createProPayment("PRO_30"), result);
  assert.equal(calls[1].url, `${API_BASE_URL}/api/payments/pro`);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { planCode: "PRO_30" });
});

test("payment status and retry use authenticated owner endpoints", async () => {
  const calls = installResponses(json({ status: "CANCELLED" }), json({ token: "csrf" }), json({ orderCode: 2, checkoutUrl: "https://payos.test/2" }));
  assert.equal((await getPaymentState(1)).status, "CANCELLED");
  assert.equal((await retryPayment(1)).orderCode, 2);
  assert.equal(calls[0].url, `${API_BASE_URL}/api/payments/orders/1`);
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[2].url, `${API_BASE_URL}/api/payments/orders/1/retry`);
  assert.equal(calls[2].options.method, "POST");
});
