import test from "node:test";
import assert from "node:assert/strict";

import { resolveHomePath } from "./roleRoutes.js";

test("USER goes to the learner dashboard", () => {
  assert.equal(resolveHomePath("USER"), "/dashboard");
});

test("ADMIN and EMPLOYEE go to the console dashboard", () => {
  assert.equal(resolveHomePath("ADMIN"), "/console/dashboard");
  assert.equal(resolveHomePath("employee"), "/console/dashboard");
});

test("unknown or missing role falls back to the learner dashboard", () => {
  assert.equal(resolveHomePath(""), "/dashboard");
  assert.equal(resolveHomePath(undefined), "/dashboard");
});
