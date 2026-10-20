import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { API_BASE_URL, ApiError, clearCsrfToken } from "./client.js";
import { updateUserProfile } from "./userLearning.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
});

function installResponse(body, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const isCsrf = url.endsWith("/api/v1/auth/csrf");
    return new Response(JSON.stringify(isCsrf ? { token: "test-csrf" } : body), {
      status: isCsrf ? 200 : status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return calls;
}

test("profile updates send editable fields only through the protected client", async () => {
  const fields = {
    displayName: "Learner",
    photoUrl: "https://example.com/avatar.png",
    targetScore: 805,
    phoneNumber: "+84901234567",
    dateOfBirth: "2001-09-18",
    gender: "PREFER_NOT_TO_SAY",
  };
  const profile = { ...fields, uid: "user-1", role: "USER" };
  const calls = installResponse(profile);

  assert.deepEqual(await updateUserProfile({
    ...fields, uid: "other-user", role: "ADMIN", email: "ignored@example.com",
    subscription: { effective: true }, createdAt: 1,
  }), profile);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, `${API_BASE_URL}/api/me`);
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.credentials, "include");
  assert.equal(calls[1].options.headers.get("X-XSRF-TOKEN"), "test-csrf");
  assert.deepEqual(JSON.parse(calls[1].options.body), fields);
});

test("profile updates preserve nulls so optional fields can be cleared", async () => {
  const fields = {
    displayName: "Learner", photoUrl: null, targetScore: null,
    phoneNumber: null, dateOfBirth: null, gender: null,
  };
  const calls = installResponse(fields);
  await updateUserProfile(fields);
  assert.deepEqual(JSON.parse(calls[1].options.body), fields);
});

for (const status of [400, 401, 403, 500]) {
  test(`profile updates preserve HTTP ${status} and error code`, async () => {
    const body = { code: "PROFILE_UPDATE_REJECTED", message: "Server message" };
    installResponse(body, status);
    await assert.rejects(() => updateUserProfile({ displayName: "Learner" }), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, status);
      assert.equal(error.body.code, body.code);
      return true;
    });
  });
}
