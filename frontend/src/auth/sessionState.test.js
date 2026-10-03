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
