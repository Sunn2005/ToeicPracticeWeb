import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./adminStaff.js", import.meta.url), "utf8");
const calls = [];
const module = await import(`data:text/javascript,${encodeURIComponent(source.replace('import { apiFetch } from "./client";', 'const apiFetch = (...args) => globalThis.__staffApiTest(...args);'))}`);

test("staff API encodes identifiers, preserves versions and excludes client roles", async () => {
  globalThis.__staffApiTest = (...args) => { calls.push(args); return Promise.resolve({}); };
  try {
    await module.saveStaffMember({ displayName: "Staff", phoneNumber: "+84912345678", email: "staff@example.test", groupId: "business", active: true, notes: "", uid: "spoof", role: "ADMIN", version: 99 }, true);
    assert.equal(calls.at(-1)[0], "/api/admin/staff/members");
    assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { displayName: "Staff", phoneNumber: "+84912345678", email: "staff@example.test", groupId: "business", active: true, notes: "" });
    await module.resendStaffCredentials("staff/unsafe");
    assert.equal(calls.at(-1)[0], "/api/admin/staff/members/staff%2Funsafe/credentials/resend");
    assert.equal(calls.at(-1)[1].method, "POST");
    await module.lookupStaffAccount(" person+test@example.test ");
    assert.match(calls.at(-1)[0], /email=person%2Btest%40example.test/);
    await module.saveStaffMember({ uid: "uid/unsafe", groupId: "accountants", active: true, notes: "", version: 3, role: "ADMIN", createdBy: "spoof" }, false);
    assert.equal(calls.at(-1)[0], "/api/admin/staff/members/uid%2Funsafe");
    assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { groupId: "accountants", active: true, notes: "", version: 3 });
    await module.deleteStaffGroup({ id: "group/unsafe", version: 4 });
    assert.equal(calls.at(-1)[0], "/api/admin/staff/groups/group%2Funsafe?version=4");
    await module.saveStaffGroup({ id: "g", name: "Finance", code: "FINANCE", description: "", permissions: ["revenue.view"], version: 4, owner: "spoof" });
    assert.equal(JSON.parse(calls.at(-1)[1].body).owner, undefined);
  } finally { delete globalThis.__staffApiTest; }
});

test("staff errors use status and stable code", () => {
  assert.equal(module.staffErrorKey({ status: 403 }), "staffErrorAccess");
  assert.equal(module.staffErrorKey({ status: 409, body: { code: "STAFF_GROUP_NOT_EMPTY", message: "unrelated" } }), "staffError_STAFF_GROUP_NOT_EMPTY");
  assert.equal(module.staffErrorKey({ status: 401 }), "staffErrorAuth");
});
