import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./staffPasswords.js", import.meta.url), "utf8");
const calls = [];
const module = await import(`data:text/javascript,${encodeURIComponent(source.replace('import { apiFetch, publicApiFetch } from "./client";', 'const apiFetch = (...args) => globalThis.__passwordApiTest("authenticated", ...args); const publicApiFetch = (...args) => globalThis.__passwordApiTest("public", ...args);'))}`);

test("recovery uses public client while profile change uses authenticated client", async () => {
  globalThis.__passwordApiTest = (...args) => { calls.push(args); return Promise.resolve(); };
  try {
    await module.requestStaffPasswordReset("staff@example.test");
    assert.deepEqual(calls.at(-1), ["public", "/api/v1/auth/staff/forgot-password", { method: "POST", body: JSON.stringify({ email: "staff@example.test" }) }]);
    await module.resetStaffPassword("staff@example.test", "one-time-token", "NewPassword123!");
    assert.equal(calls.at(-1)[0], "public");
    assert.deepEqual(JSON.parse(calls.at(-1)[2].body), { email: "staff@example.test", token: "one-time-token", newPassword: "NewPassword123!" });
    await module.changeStaffPassword("old", "NewPassword123!");
    assert.equal(calls.at(-1)[0], "authenticated");
    assert.equal(calls.at(-1)[1], "/api/console/account/password");
    assert.deepEqual(JSON.parse(calls.at(-1)[2].body), { oldPassword: "old", newPassword: "NewPassword123!" });
  } finally { delete globalThis.__passwordApiTest; }
});

test("password errors use stable status and codes without exposing provider messages", () => {
  assert.equal(module.passwordErrorKey({ body: { code: "STAFF_RESET_INVALID", message: "provider-private-response" } }), "staffError_STAFF_RESET_INVALID");
  assert.equal(module.passwordErrorKey({ status: 401 }), "staffErrorAuth");
  assert.equal(module.passwordErrorKey({ message: "provider-private-response" }), "staffErrorRequest");
});
