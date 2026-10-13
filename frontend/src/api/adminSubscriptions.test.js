import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { API_BASE_URL, ApiError, clearCsrfToken } from "./client.js";
import { getSubscription, upsertSubscription, revokeSubscription } from "./adminSubscriptions.js";

const originalFetch = globalThis.fetch;
const summary = {
  planCode: "PRO", status: "ACTIVE", startsAt: 1800000000000,
  expiresAt: 1802592000000, entitlements: ["AI_CHAT", "AI_ANALYSIS"], effective: true,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
});

function installResponses(...responses) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.ok(responses.length, "Unexpected request");
    return responses.shift();
  };
  return calls;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("lookup encodes the UID and returns the server subscription summary", async () => {
  const calls = installResponses(json(summary));
  assert.deepEqual(await getSubscription("user/with space?#"), summary);
  assert.equal(calls[0].url, `${API_BASE_URL}/api/admin/subscriptions/user%2Fwith%20space%3F%23`);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.credentials, "include");
});

test("activation sends only the exact expiry epoch through the protected client", async () => {
  const calls = installResponses(json({ token: "test-csrf" }), json(summary));
  assert.deepEqual(await upsertSubscription("user/one", 1802592000000), summary);
  assert.equal(calls[1].url, `${API_BASE_URL}/api/admin/subscriptions/user%2Fone`);
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].options.body), { expiresAt: 1802592000000 });
  assert.equal(new Headers(calls[1].options.headers).get("Content-Type"), "application/json");
  assert.equal(new Headers(calls[1].options.headers).get("X-XSRF-TOKEN"), "test-csrf");
});

test("revocation uses DELETE without a body and returns the revoked summary", async () => {
  const revoked = { ...summary, status: "REVOKED", effective: false };
  const calls = installResponses(json({ token: "test-csrf" }), json(revoked));
  assert.deepEqual(await revokeSubscription("user/one"), revoked);
  assert.equal(calls[1].url, `${API_BASE_URL}/api/admin/subscriptions/user%2Fone`);
  assert.equal(calls[1].options.method, "DELETE");
  assert.equal(calls[1].options.body, undefined);
});

test("lookup preserves a no-subscription summary", async () => {
  const empty = { planCode: null, status: null, startsAt: null, expiresAt: null, entitlements: [], effective: false };
  installResponses(json(empty));
  assert.deepEqual(await getSubscription("user-one"), empty);
});

test("subscription failures preserve stable status and body code", async () => {
  installResponses(json({ token: "test-csrf" }), json({ code: "SUBSCRIPTION_EXPIRY_INVALID", message: "Localized message" }, 400));
  await assert.rejects(() => upsertSubscription("user-one", 1), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.body.code, "SUBSCRIPTION_EXPIRY_INVALID");
    return true;
  });
});
