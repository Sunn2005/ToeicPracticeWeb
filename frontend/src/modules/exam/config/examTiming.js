export const TIMER_TYPES = {
  COUNTDOWN: "countdown",
  ELAPSED: "elapsed",
  UNTIMED: "untimed",
};

export const PART_TIME_LIMITS = {
  1: 5 * 60,
  2: 10 * 60,
  3: 15 * 60,
  4: 15 * 60,
  5: 20 * 60,
  6: 10 * 60,
  7: 45 * 60,
};

const MODE_TIME_LIMITS = {
  FULL: 120 * 60,
  LISTENING: 45 * 60,
  READING: 75 * 60,
};

function normalizeMode(mode) {
  return typeof mode === "string" ? mode.trim().toUpperCase() : "";
}

export function isListeningPart(mode, part) {
  return normalizeMode(mode) === "PART" && part >= 1 && part <= 4;
}

export function normalizeSelectedParts(parts, part) {
  const values = Array.isArray(parts) && parts.length ? parts : part ? [part] : [];
  return [...new Set(values.map(Number).filter((value) => value >= 1 && value <= 7))]
    .sort((left, right) => left - right);
}

export function getSuggestedPartDuration(parts) {
  return normalizeSelectedParts(parts)
    .reduce((total, part) => total + PART_TIME_LIMITS[part], 0);
}

export function getExamDuration(mode, part, parts, timeLimitSeconds) {
  if (Number.isFinite(timeLimitSeconds) && timeLimitSeconds > 0) {
    return timeLimitSeconds;
  }
  const normalizedMode = normalizeMode(mode);
  if (normalizedMode === "PART") {
    const selectedParts = normalizeSelectedParts(parts, part);
    return selectedParts.length ? getSuggestedPartDuration(selectedParts) : null;
  }
  return MODE_TIME_LIMITS[normalizedMode] ?? null;
}

export function getTimerType(attemptOrMode) {
  if (attemptOrMode && typeof attemptOrMode === "object") {
    return attemptOrMode.timed === false
      ? TIMER_TYPES.UNTIMED
      : TIMER_TYPES.COUNTDOWN;
  }
  return TIMER_TYPES.COUNTDOWN;
}

export function getTimerSeconds(attempt, serverNow) {
  if (!attempt?.startedAt) return 0;

  const elapsed = Math.max(0, Math.floor((serverNow - attempt.startedAt) / 1000));
  const timerType = getTimerType(attempt);
  if (timerType === TIMER_TYPES.UNTIMED) {
    return 0;
  }
  if (timerType === TIMER_TYPES.ELAPSED) {
    return elapsed;
  }

  const duration = getExamDuration(
    attempt.mode,
    attempt.selectedPart,
    attempt.selectedParts,
    attempt.timeLimitSeconds,
  );
  return duration === null ? 0 : Math.max(0, duration - elapsed);
}

export function isLastListeningUnit(currentUnit, listeningUnits) {
  if (!currentUnit || !listeningUnits?.length) return false;
  return currentUnit.key === listeningUnits[listeningUnits.length - 1].key;
}

export function shouldSubmitAfterListeningAudio() {
  return false;
}

export function shouldDisableSubmit(attempt, busy = false) {
  return Boolean(busy)
    || (String(attempt?.type || "FULL_TEST").toUpperCase() === "FULL_TEST"
      && normalizeMode(attempt?.mode) === "FULL"
      && attempt?.currentSection === "LISTENING");
}
