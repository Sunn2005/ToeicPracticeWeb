import test from "node:test";
import assert from "node:assert/strict";
import {
  PART_TIME_LIMITS,
  TIMER_TYPES,
  getExamDuration,
  getSuggestedPartDuration,
  getTimerSeconds,
  getTimerType,
  shouldDisableSubmit,
  shouldSubmitAfterListeningAudio,
} from "./examTiming.js";

test("Part 1 uses its suggested countdown and submits after its last audio", () => {
  const units = [{ key: "part1-1" }, { key: "part1-6" }];
  const attempt = { mode: "PART", selectedPart: 1, startedAt: 1_000 };

  assert.equal(getExamDuration("PART", 1), 5 * 60);
  assert.equal(getTimerType("PART", 1), TIMER_TYPES.COUNTDOWN);
  assert.equal(getTimerSeconds(attempt, 6_000), 4 * 60 + 55);
  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[0], units), false);
  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[1], units), true);
});

test("Part 3 submits only after the last question group audio", () => {
  const units = [{ key: "32-34" }, { key: "68-70" }];
  const attempt = { mode: "PART", selectedPart: 3, startedAt: 1_000 };

  assert.equal(getTimerType("PART", 3), TIMER_TYPES.COUNTDOWN);
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

test("multiple Parts sum suggested time and respect a custom attempt limit", () => {
  assert.equal(getSuggestedPartDuration([5, 6]), 30 * 60);
  assert.equal(getExamDuration("PART", null, [5, 6]), 30 * 60);
  assert.equal(getExamDuration("PART", null, [5, 6], 25 * 60), 25 * 60);
});

test("mixed Listening and Reading Parts continue after the final Listening audio", () => {
  const units = [{ key: "part1-6" }];
  const attempt = { mode: "PART", selectedParts: [1, 5] };

  assert.equal(shouldSubmitAfterListeningAudio(attempt, units[0], units), false);
});

test("full, listening and reading retain their standard countdowns", () => {
  assert.equal(getExamDuration("FULL"), 120 * 60);
  assert.equal(getExamDuration("LISTENING"), 45 * 60);
  assert.equal(getExamDuration("READING"), 75 * 60);
});

test("full test locks submit during Listening and unlocks it in Reading", () => {
  assert.equal(
    shouldDisableSubmit({ mode: "FULL", currentSection: "LISTENING" }),
    true,
  );
  assert.equal(
    shouldDisableSubmit({ mode: "FULL", currentSection: "READING" }),
    false,
  );
  assert.equal(
    shouldDisableSubmit({ mode: "LISTENING", currentSection: "LISTENING" }),
    false,
  );
  assert.equal(
    shouldDisableSubmit({ mode: "FULL", currentSection: "READING" }, true),
    true,
  );
});
