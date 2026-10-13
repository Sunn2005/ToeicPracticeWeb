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

test("unsafe request refreshes CSRF and retries once after CSRF_TOKEN_INVALID", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "stale-token" }),
    jsonResponse({ code: "CSRF_TOKEN_INVALID", message: "Stale" }, 403),
    jsonResponse({ token: "fresh-token" }),
    jsonResponse({ saved: true }),
  );

  const result = await apiFetch("/api/attempts/attempt-1/answers", {
    method: "PATCH",
    body: JSON.stringify({ answers: { 101: "C" } }),
  });

  assert.deepEqual(result, { saved: true });
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /\/api\/v1\/auth\/csrf$/);
  assert.equal(new Headers(calls[1].options.headers).get("X-XSRF-TOKEN"), "stale-token");
  assert.match(calls[2].url, /\/api\/v1\/auth\/csrf$/);
  assert.equal(new Headers(calls[3].options.headers).get("X-XSRF-TOKEN"), "fresh-token");
  assert.equal(calls[3].options.body, calls[1].options.body);
});

test("a repeated CSRF_TOKEN_INVALID response is propagated after one retry", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "stale-token" }),
    jsonResponse({ code: "CSRF_TOKEN_INVALID", message: "Stale" }, 403),
    jsonResponse({ token: "fresh-token" }),
    jsonResponse({ code: "CSRF_TOKEN_INVALID", message: "Still invalid" }, 403),
  );

  await assert.rejects(
    () => apiFetch("/api/attempts/attempt-1/submit", { method: "POST" }),
    (error) => {
      assert.equal(error instanceof ApiError, true);
      assert.equal(error.status, 403);
      assert.equal(error.body.code, "CSRF_TOKEN_INVALID");
      assert.equal(error.message, "Still invalid");
      return true;
    },
  );

  assert.equal(calls.length, 4);
});

test("non-CSRF forbidden responses are not retried", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "csrf-token" }),
    jsonResponse({ code: "ACCESS_DENIED", message: "Forbidden" }, 403),
  );

  await assert.rejects(
    () => apiFetch("/api/admin/subscriptions/user-1", { method: "DELETE" }),
    (error) => error instanceof ApiError && error.body.code === "ACCESS_DENIED",
  );

  assert.equal(calls.length, 2);
});

test("CSRF retry preserves FormData boundary ownership and AbortSignal", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "stale-token" }),
    jsonResponse({ code: "CSRF_TOKEN_INVALID", message: "Stale" }, 403),
    jsonResponse({ token: "fresh-token" }),
    jsonResponse({ uploaded: true }),
  );
  const body = new FormData();
  body.set("file", new Blob(["data"]), "test.txt");
  const controller = new AbortController();

  await apiFetch("/api/employee/media", {
    method: "POST",
    body,
    signal: controller.signal,
  });

  assert.equal(calls.length, 4);
  for (const index of [1, 3]) {
    assert.equal(calls[index].options.body, body);
    assert.equal(calls[index].options.signal, controller.signal);
    assert.equal(new Headers(calls[index].options.headers).has("Content-Type"), false);
  }
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
    jsonResponse({ token: "anonymous-csrf-token" }),
    jsonResponse({ uid: "uid-1", role: "USER" }),
    jsonResponse({ token: "session-csrf-token" }),
    emptyResponse(204),
    jsonResponse({ token: "new-csrf-token" }),
  );

  const profile = await createSession("temporary-id-token");
  await destroySession();
  const nextToken = await getCsrfToken();

  assert.equal(profile.uid, "uid-1");
  assert.deepEqual(JSON.parse(calls[1].options.body), { idToken: "temporary-id-token" });
  assert.equal(new Headers(calls[1].options.headers).get("X-XSRF-TOKEN"), "anonymous-csrf-token");
  assert.match(calls[2].url, /\/api\/v1\/auth\/csrf$/);
  assert.match(calls[3].url, /\/api\/v1\/auth\/logout$/);
  assert.equal(new Headers(calls[3].options.headers).get("X-XSRF-TOKEN"), "session-csrf-token");
  assert.equal(nextToken, "new-csrf-token");
});

test("successful session creation clears the pre-authentication CSRF token", async () => {
  const calls = installFetchQueue(
    jsonResponse({ token: "anonymous-token" }),
    jsonResponse({ uid: "uid-1", role: "USER" }),
    jsonResponse({ token: "session-token" }),
  );

  assert.equal(await getCsrfToken(), "anonymous-token");
  await createSession("temporary-id-token");
  assert.equal(await getCsrfToken(), "session-token");

  assert.equal(calls.length, 3);
  assert.equal(new Headers(calls[1].options.headers).get("X-XSRF-TOKEN"), "anonymous-token");
  assert.match(calls[2].url, /\/api\/v1\/auth\/csrf$/);
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
