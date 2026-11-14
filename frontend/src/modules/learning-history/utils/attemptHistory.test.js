import assert from "node:assert/strict";
import test from "node:test";
import {
  getAttemptDurationSeconds,
  getAttemptParts,
  getHistoryStats,
  getFullMockScoreSummary,
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
      type: "FULL_TEST",
      status: "COMPLETED",
      startedAt: now - 60_000,
      submittedAt: now,
      result: { totalCorrect: 8, totalQuestions: 10 },
    },
    {
      type: "PRACTICE",
      status: "COMPLETED",
      startedAt: now - 120_000,
      submittedAt: now,
      result: { totalCorrect: 7, totalQuestions: 10 },
    },
    { status: "IN_PROGRESS", startedAt: now },
  ];

  assert.equal(getAttemptDurationSeconds(attempts[0]), 60);
  assert.deepEqual(getHistoryStats(attempts), {
    completed: 1,
    practiceCompleted: 1,
    inProgress: 1,
    accuracy: 80,
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

test("summarizes only scored, completed full mock exams", () => {
  const completed = (mode, totalScore, type = "FULL_TEST") => ({
    mode, type, status: "COMPLETED", result: { totalScore },
  });
  const excluded = [
    completed("LISTENING", 495),
    completed("PART", 980),
    completed("FULL", 990, "PRACTICE"),
    { ...completed("FULL", 900), status: "IN_PROGRESS" },
    completed("FULL", undefined),
  ];

  assert.deepEqual(getFullMockScoreSummary(excluded), { best: null, average: null });
  assert.deepEqual(
    getFullMockScoreSummary([...excluded, completed("FULL", 600), completed("FULL", 800)]),
    { best: 800, average: 700 },
  );
});
