import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttemptDurationSeconds,
  getAttemptParts,
  getHistoryStats,
  getSubmittedAttempts,
} from "./attemptHistory.js";

test("resolves selected Parts for every attempt mode", () => {
  assert.deepEqual(getAttemptParts({ selectedParts: [2, 5] }), [2, 5]);
  assert.deepEqual(getAttemptParts({ mode: "LISTENING" }), [1, 2, 3, 4]);
  assert.deepEqual(getAttemptParts({ mode: "READING" }), [5, 6, 7]);
  assert.deepEqual(getAttemptParts({ mode: "FULL" }), [1, 2, 3, 4, 5, 6, 7]);
});

test("calculates attempt duration and dashboard history statistics", () => {
  const now = Date.now();
  const attempts = [
    {
      status: "COMPLETED",
      startedAt: now - 60_000,
      submittedAt: now,
      result: { totalCorrect: 8, totalQuestions: 10 },
    },
    {
      status: "COMPLETED",
      startedAt: now - 120_000,
      submittedAt: now,
      result: { totalCorrect: 7, totalQuestions: 10 },
    },
    { status: "IN_PROGRESS", startedAt: now },
  ];

  assert.equal(getAttemptDurationSeconds(attempts[0]), 60);
  assert.deepEqual(getHistoryStats(attempts), {
    completed: 2,
    accuracy: 75,
    streak: 1,
  });
});

test("keeps only submitted attempts in history", () => {
  const completed = { id: "completed", status: "COMPLETED" };
  const attempts = [
    { id: "in-progress", status: "IN_PROGRESS" },
    completed,
  ];

  assert.deepEqual(getSubmittedAttempts(attempts), [completed]);
  assert.deepEqual(getSubmittedAttempts(null), []);
});
