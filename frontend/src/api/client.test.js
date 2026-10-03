import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  ApiError,
  API_BASE_URL,
  apiFetch,
  clearCsrfToken,
  getCsrfToken,
  publicApiFetch,
} from "./client.js";
import { createSession, destroySession } from "./auth.js";

const originalFetch = globalThis.fetch;

test("production fallback uses the same-site custom API domain", () => {
  assert.equal(API_BASE_URL, "https://api.capytoeic.id.vn");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
});

test("authenticated GET includes browser credentials without an Authorization header", async () => {
  const calls = installFetchQueue(jsonResponse({ uid: "uid-1" }));

  const result = await apiFetch("/api/me");

  assert.deepEqual(result, { uid: "uid-1" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(new Headers(calls[0].options.headers).has("Authorization"), false);
});

test("unsafe request loads CSRF once and sends it in the expected header", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "csrf-token" }),
    jsonResponse({ saved: true }),
    jsonResponse({ saved: true }),
  );

  await apiFetch("/api/me", { method: "PATCH", body: JSON.stringify({ displayName: "A" }) });
  await apiFetch("/api/me", { method: "PATCH", body: JSON.stringify({ displayName: "B" }) });

  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\/api\/v1\/auth\/csrf$/);
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(new Headers(calls[1].options.headers).get("X-XSRF-TOKEN"), "csrf-token");
  assert.equal(new Headers(calls[2].options.headers).get("X-XSRF-TOKEN"), "csrf-token");
});

test("clearing CSRF state makes the next unsafe request obtain a new token", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "first-token" }),
    jsonResponse({ saved: true }),
    jsonResponse({ token: "second-token" }),
    jsonResponse({ saved: true }),
  );

  await apiFetch("/api/me", { method: "PATCH", body: "{}" });
  clearCsrfToken();
  await apiFetch("/api/me", { method: "PATCH", body: "{}" });

  assert.equal(calls.length, 4);
  assert.equal(new Headers(calls[1].options.headers).get("X-XSRF-TOKEN"), "first-token");
  assert.equal(new Headers(calls[3].options.headers).get("X-XSRF-TOKEN"), "second-token");
});

test("FormData keeps the browser-generated multipart boundary", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "csrf-token" }),
    jsonResponse({ uploaded: true }),
  );
  const body = new FormData();
  body.set("file", new Blob(["data"]), "test.txt");

  await apiFetch("/api/employee/media", { method: "POST", body });

  assert.equal(new Headers(calls[1].options.headers).has("Content-Type"), false);
});

test("JSON API failures preserve status and structured body", async () => {
  installFetchQueue(jsonResponse(
    { code: "AUTHENTICATION_REQUIRED", message: "Please sign in" },
    401,
  ));

  await assert.rejects(
    () => apiFetch("/api/me"),
    (error) => {
      assert.equal(error instanceof ApiError, true);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Please sign in");
      assert.equal(error.body.code, "AUTHENTICATION_REQUIRED");
      return true;
    },
  );
});

test("401 is propagated without a hidden token refresh retry", async () => {
  const calls = installFetchQueue(jsonResponse({ message: "Expired" }, 401));

  await assert.rejects(() => apiFetch("/api/me"), ApiError);

  assert.equal(calls.length, 1);
});

test("public requests also include credentials so optional sessions are consistent", async () => {
  const calls = installFetchQueue(jsonResponse([]));

  await publicApiFetch("/api/tests");

  assert.equal(calls[0].options.credentials, "include");
});

test("session helpers exchange only the temporary ID token and clear CSRF on logout", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "csrf-token" }),
    jsonResponse({ uid: "uid-1", role: "USER" }),
    emptyResponse(204),
    jsonResponse({ token: "new-csrf-token" }),
  );

  const profile = await createSession("temporary-id-token");
  await destroySession();
  const nextToken = await getCsrfToken();

  assert.equal(profile.uid, "uid-1");
  assert.deepEqual(JSON.parse(calls[1].options.body), { idToken: "temporary-id-token" });
  assert.match(calls[2].url, /\/api\/v1\/auth\/logout$/);
  assert.equal(nextToken, "new-csrf-token");
});

function installFetchQueue(...responses) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const response = responses.shift();
    assert.ok(response, `Unexpected fetch call to ${url}`);
    return response;
  };
  return calls;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status) {
  return new Response(null, { status });
}
