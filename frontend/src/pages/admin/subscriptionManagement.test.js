import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultExpiry, expiryEpoch, subscriptionStatusKey, subscriptionErrorKey } from "./subscriptionManagement.js";

test("expiry defaults to 30 calendar days in browser local time", () => {
  assert.equal(defaultExpiry(new Date(2026, 0, 2, 10, 30, 15)), "2026-02-01T10:30:15");
});

test("expiry validation rejects empty, invalid, past and present values", () => {
  const now = new Date(2026, 0, 2, 10, 30, 15).getTime();
  for (const value of ["", "invalid", "2026-01-01T10:30:15", "2026-01-02T10:30:15"]) {
    assert.equal(expiryEpoch(value, now), null);
  }
  assert.equal(expiryEpoch("2026-01-02T10:30:16", now), now + 1000);
});

test("summary status uses server effectiveness and keeps expired and revoked distinguishable", () => {
  assert.equal(subscriptionStatusKey({ status: null, effective: false }), "adminSubscriptionNone");
  assert.equal(subscriptionStatusKey({ status: "ACTIVE", effective: true }), "adminSubscriptionActive");
  assert.equal(subscriptionStatusKey({ status: "ACTIVE", effective: false }), "adminSubscriptionExpired");
  assert.equal(subscriptionStatusKey({ status: "EXPIRED", effective: false }), "adminSubscriptionExpired");
  assert.equal(subscriptionStatusKey({ status: "REVOKED", effective: false }), "adminSubscriptionRevoked");
});

test("errors use status and stable body codes even when messages change", () => {
  for (const message of ["different wording", "localized message"]) {
    assert.equal(subscriptionErrorKey({ status: 401, message }), "adminSubscriptionAuthError");
    assert.equal(subscriptionErrorKey({ status: 403, message }), "adminSubscriptionAccessError");
    assert.equal(subscriptionErrorKey({ status: 400, body: { code: "SUBSCRIPTION_EXPIRY_INVALID" }, message }), "adminSubscriptionExpiryError");
    assert.equal(subscriptionErrorKey({ status: 404, message }), "adminSubscriptionNotFoundError");
    assert.equal(subscriptionErrorKey({ status: 503, message }), "adminSubscriptionRequestError");
  }
});
