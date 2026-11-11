import assert from "node:assert/strict";
import test from "node:test";
import {
  exchangeFirebaseSession,
  loadBackendSession,
  terminateBackendSession,
} from "./sessionState.js";

test("session bootstrap returns an authenticated profile on 200", async () => {
  const result = await loadBackendSession(async () => ({ uid: "uid-1", role: "USER" }));

  assert.deepEqual(result, {
    status: "authenticated",
    profile: { uid: "uid-1", role: "USER" },
    error: "",
  });
});

test("session bootstrap treats only 401 as an anonymous browser", async () => {
  const result = await loadBackendSession(async () => {
    throw Object.assign(new Error("Expired"), { status: 401 });
  });

  assert.deepEqual(result, { status: "anonymous", profile: null, error: "" });
});

test("session bootstrap preserves the backend subscription summary unchanged", async () => {
  const subscription = {
    planCode: "PRO",
    status: "ACTIVE",
    startsAt: 1000,
    expiresAt: 3000,
    entitlements: ["AI_CHAT", "AI_ANALYSIS"],
    effective: true,
  };
  const result = await loadBackendSession(async () => ({
    uid: "uid-1", role: "USER", subscription,
  }));

  assert.equal(result.status, "authenticated");
  assert.deepEqual(result.profile.subscription, {
    planCode: "PRO", status: "ACTIVE", startsAt: 1000, expiresAt: 3000,
    entitlements: ["AI_CHAT", "AI_ANALYSIS"], effective: true,
  });
  assert.equal(result.profile.role, "USER");
});

test("an unauthorized reload clears a previously loaded Pro subscription", async () => {
  const loaded = await loadBackendSession(async () => ({
    uid: "uid-1", role: "USER",
    subscription: {
      planCode: "PRO", status: "ACTIVE", startsAt: 1000, expiresAt: 3000,
      entitlements: ["AI_CHAT", "AI_ANALYSIS"], effective: true,
    },
  }));
  assert.equal(loaded.profile.subscription.effective, true);

  const result = await loadBackendSession(async () => {
    throw Object.assign(new Error("Expired"), { status: 401 });
  });

  assert.deepEqual(result, { status: "anonymous", profile: null, error: "" });
});

test("session bootstrap preserves network failures as retryable errors", async () => {
  const result = await loadBackendSession(async () => {
    throw new Error("Backend unavailable");
  });

  assert.deepEqual(result, {
    status: "unavailable",
    profile: null,
    error: "Backend unavailable",
  });
});

test("a stalled bootstrap times out, aborts HTTP, and ignores a late profile", async () => {
  let requestSignal;
  let complete;
  const pending = loadBackendSession((signal) => {
    requestSignal = signal;
    return new Promise((resolve) => { complete = resolve; });
  }, { timeoutMs: 5 });
  const result = await pending;
  assert.equal(result.status, "unavailable");
  assert.equal(result.profile, null);
  assert.equal(requestSignal.aborted, true);
  complete({ uid: "late-user", role: "ADMIN" });
  assert.equal((await pending).status, "unavailable");

  // Retry can restore the actual cookie session after the API recovers.
  const retried = await loadBackendSession(async () => ({ uid: "current-user", role: "USER" }));
  assert.equal(retried.status, "authenticated");
  assert.equal(retried.profile.uid, "current-user");
});

test("superseding login/unmount cancels a pending session request", async () => {
  const controller = new AbortController();
  let requestSignal;
  const pending = loadBackendSession((signal) => {
    requestSignal = signal;
    return new Promise(() => {});
  }, { signal: controller.signal });
  await Promise.resolve();
  controller.abort();
  const result = await pending;
  assert.equal(requestSignal.aborted, true);
  assert.notEqual(result.status, "authenticated");
  assert.equal(controller.signal.aborted, true);
});

test("an already cancelled check never starts an HTTP request", async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await loadBackendSession(() => { called = true; }, { signal: controller.signal });
  assert.equal(called, false);
});

test("interactive Firebase login exchanges a fresh ID token and clears the temporary user", async () => {
  const calls = [];
  const firebaseUser = {
    async getIdToken(forceRefresh) {
      calls.push(["token", forceRefresh]);
      return "temporary-id-token";
    },
  };

  const profile = await exchangeFirebaseSession(
    firebaseUser,
    async (idToken) => {
      calls.push(["session", idToken]);
      return { uid: "uid-1", role: "USER" };
    },
    async () => calls.push(["clear"]),
  );

  assert.deepEqual(profile, { uid: "uid-1", role: "USER" });
  assert.deepEqual(calls, [
    ["token", true],
    ["session", "temporary-id-token"],
    ["clear"],
  ]);
});

test("failed session exchange still clears Firebase client credentials", async () => {
  const calls = [];
  const firebaseUser = { getIdToken: async () => "temporary-id-token" };

  await assert.rejects(
    () => exchangeFirebaseSession(
      firebaseUser,
      async () => {
        throw new Error("Session rejected");
      },
      async () => calls.push("clear"),
    ),
    /Session rejected/,
  );

  assert.deepEqual(calls, ["clear"]);
});

test("logout clears the backend cookie before the temporary Firebase user", async () => {
  const calls = [];

  await terminateBackendSession(
    async () => calls.push("backend"),
    async () => calls.push("firebase"),
  );

  assert.deepEqual(calls, ["backend", "firebase"]);
});

test("logout signs out of Firebase when the backend logout fails", async () => {
  const calls = [];
  const backendError = new Error("Logout failed");

  await assert.rejects(
    () => terminateBackendSession(
      async () => {
        calls.push("backend");
        throw backendError;
      },
      async () => calls.push("firebase"),
    ),
    (error) => error === backendError,
  );

  assert.deepEqual(calls, ["backend", "firebase"]);
});
