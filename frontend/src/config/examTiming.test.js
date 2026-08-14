import test from "node:test";
import assert from "node:assert/strict";
import {
  PART_TIME_LIMITS,
  TIMER_TYPES,
  getExamDuration,
  getTimerSeconds,
  getTimerType,
  shouldSubmitAfterListeningAudio,
} from "./examTiming.js";

test("Part 1 uses elapsed time and submits after its last audio", () => {
  const units = [{ key: "part1-1" }, { key: "part1-6" }];
  const attempt = { mode: "PART", selectedPart: 1, startedAt: 1_000 };

  assert.equal(getExamDuration("PART", 1), null);
  assert.equal(getTimerType("PART", 1), TIMER_TYPES.ELAPSED);
  assert.equal(getTimerSeconds(attempt, 6_000), 5);
  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[0], units), false);
  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[1], units), true);
});

test("Part 3 submits only after the last question group audio", () => {
  const units = [{ key: "32-34" }, { key: "68-70" }];
  const attempt = { mode: "PART", selectedPart: 3, startedAt: 1_000 };

  assert.equal(getTimerType("PART", 3), TIMER_TYPES.ELAPSED);
  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[0], units), false);
  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[1], units), true);
});

test("Part 5 uses a 20-minute countdown", () => {
  const attempt = { mode: "PART", selectedPart: 5, startedAt: 1_000 };

  assert.equal(getExamDuration("PART", 5), PART_TIME_LIMITS[5]);
  assert.equal(getTimerType("PART", 5), TIMER_TYPES.COUNTDOWN);
  assert.equal(getTimerSeconds(attempt, 1_000), 20 * 60);
  assert.equal(getTimerSeconds(attempt, 61_000), 19 * 60);
});

test("full, listening and reading retain their standard countdowns", () => {
  assert.equal(getExamDuration("FULL"), 120 * 60);
  assert.equal(getExamDuration("LISTENING"), 45 * 60);
  assert.equal(getExamDuration("READING"), 75 * 60);
});
