import assert from "node:assert/strict";
import test from "node:test";
import { canUseConsole, consoleHome, consoleRoutePermission, togglePermission } from "./consolePermissions.js";
import { staffTranslations } from "../i18n/staffTranslations.js";

test("accountant only accesses granted features and cannot manage staff", () => {
  const profile = { role: "EMPLOYEE", consoleAccess: { active: true, permissions: ["orders.view", "revenue.view"] } };
  assert.equal(canUseConsole(profile, consoleRoutePermission("/console/revenue")), true);
  assert.equal(canUseConsole(profile, "tests.view"), false);
  assert.equal(canUseConsole({ ...profile, consoleAccess: { active: true, permissions: ["staff.view"] } }, "staff.view"), false);
  assert.equal(consoleHome(profile), "/console/orders");
  assert.equal(canUseConsole({ ...profile, consoleAccess: { active: false, permissions: ["revenue.view"] } }, "revenue.view"), false);
  assert.equal(canUseConsole({ role: "USER" }, "dashboard.view"), false);
});

test("legacy employees retain authoring and protected admins retain all functions", () => {
  assert.equal(canUseConsole({ role: "EMPLOYEE" }, "tests.edit"), true);
  assert.equal(canUseConsole({ role: "EMPLOYEE" }, "reviews.edit"), false);
  assert.equal(canUseConsole({ role: "ADMIN" }, "staff.view"), true);
  assert.equal(canUseConsole({ role: "ADMIN", consoleAccess: { active: false } }, "staff.view"), false);
  assert.equal(consoleHome({ role: "EMPLOYEE", consoleAccess: { active: true, permissions: [] } }), "/console/profile");
  assert.equal(consoleRoutePermission("/console/tests/new"), "tests.add");
  assert.equal(consoleRoutePermission("/console/tests/abc/edit"), "tests.edit");
  assert.equal(consoleRoutePermission("/console/review-history"), "history.view");
});

test("matrix keeps action dependencies and All only includes applicable actions", () => {
  const feature = { id: "tests", actions: ["view", "edit", "delete"] };
  assert.deepEqual(new Set(togglePermission([], feature, "edit", true)), new Set(["tests.edit", "tests.view"]));
  assert.deepEqual(togglePermission(["tests.view", "tests.edit"], feature, "view", false), []);
  assert.deepEqual(togglePermission(["tests.view", "orders.view"], feature, "blocked", true), ["orders.view"]);
  assert.deepEqual(new Set(togglePermission([], feature, "all", true)), new Set(["tests.view", "tests.edit", "tests.delete"]));
  assert.deepEqual(togglePermission([], feature, "blocked", false), ["tests.view"]);
});

test("all staff translation keys exist in both languages", () => {
  assert.deepEqual(Object.keys(staffTranslations.vi).sort(), Object.keys(staffTranslations.en).sort());
  for (const locale of Object.values(staffTranslations)) assert.ok(Object.values(locale).every((value) => typeof value === "string" && value.length));
});


test("retired Pro management permissions never restore access or become a console home", () => {
  const oldPermissions = ["subscriptions.view", "subscriptions.grant", "subscriptions.revoke"];
  for (const role of ["ADMIN", "EMPLOYEE"]) {
    const profile = { role, consoleAccess: { active: true, permissions: oldPermissions } };
    for (const permission of oldPermissions) assert.equal(canUseConsole(profile, permission), false);
  }
  assert.equal(consoleHome({ role: "EMPLOYEE", consoleAccess: { active: true, permissions: oldPermissions } }), "/console/profile");
});


test("mandatory password changes block console features and profile is available to active staff", () => {
  assert.equal(consoleHome({ role: "EMPLOYEE", passwordChangeRequired: true }), "/console/change-password");
  assert.equal(canUseConsole({ role: "ADMIN", passwordChangeRequired: true }, "staff.view"), false);
  assert.equal(consoleRoutePermission("/console/profile"), "account.view");
  assert.equal(canUseConsole({ role: "EMPLOYEE", consoleAccess: { active: true, permissions: [] } }, "account.view"), true);
  assert.equal(canUseConsole({ role: "USER" }, "account.view"), false);
  assert.equal(canUseConsole({ role: "EMPLOYEE", consoleAccess: { active: false, permissions: [] } }, "account.view"), false);
});
