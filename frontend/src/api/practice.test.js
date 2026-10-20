import assert from "node:assert/strict";
import test from "node:test";
import { loadPracticePart, startPracticeAttempt } from "./practice.js";

test("legacy practice part uses the public shared client", async () => {
  const calls = [];
  const result = await loadPracticePart("test_001", "part5", async (...args) => {
    calls.push(args);
    return { partNumber: 5 };
  });

  assert.deepEqual(result, { partNumber: 5 });
  assert.deepEqual(calls, [["/api/tests/test_001/parts/part5"]]);
});

test("legacy practice attempt uses the protected shared client", async () => {
  const calls = [];
  const result = await startPracticeAttempt("test_001", async (...args) => {
    calls.push(args);
    return { id: "attempt-1" };
  });

  assert.deepEqual(result, { id: "attempt-1" });
  assert.equal(calls[0][0], "/api/attempts");
  assert.deepEqual(calls[0][1], {
    method: "POST",
    body: JSON.stringify({ testId: "test_001" }),
  });
});
