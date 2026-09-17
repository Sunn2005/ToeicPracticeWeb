import test from "node:test";
import assert from "node:assert/strict";
import { canRequestAIAnalysis, shouldPollAIAnalysis } from "./aiAnalysis.js";

test("polls only while an AI analysis is active", () => {
  assert.equal(shouldPollAIAnalysis("PENDING"), true);
  assert.equal(shouldPollAIAnalysis("PROCESSING"), true);
  assert.equal(shouldPollAIAnalysis("COMPLETED"), false);
  assert.equal(shouldPollAIAnalysis("FAILED"), false);
});

test("offers analysis only for completed-result Full Test mode", () => {
  assert.equal(canRequestAIAnalysis({ type: "FULL_TEST", mode: "FULL" }), true);
  assert.equal(canRequestAIAnalysis({ type: "PRACTICE", mode: "PART" }), false);
  assert.equal(canRequestAIAnalysis({ type: "FULL_TEST", mode: "READING" }), false);
});
