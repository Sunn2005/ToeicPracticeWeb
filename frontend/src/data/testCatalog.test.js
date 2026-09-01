import assert from "node:assert/strict";
import test from "node:test";
import { TOEIC_TESTS, getTestName, getTestTitle } from "./testCatalog.js";

test("all imported TOEIC tests are available for exam and practice", () => {
  assert.deepEqual(
    TOEIC_TESTS.map(({ id, available }) => ({ id, available })),
    [
      { id: "test-1", available: true },
      { id: "test-2", available: true },
      { id: "test-3", available: true },
    ],
  );
});

test("test labels are resolved from the active test id", () => {
  assert.equal(getTestName("test-2"), "Test 2");
  assert.equal(getTestTitle("test-3"), "TOEIC Listening & Reading – Test 3");
});
