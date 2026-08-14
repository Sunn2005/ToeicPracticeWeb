export const TIMER_TYPES = {
  COUNTDOWN: "countdown",
  ELAPSED: "elapsed",
};

export const PART_TIME_LIMITS = {
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

export function getExamDuration(mode, part) {
  const normalizedMode = normalizeMode(mode);
  if (normalizedMode === "PART") {
    return isListeningPart(normalizedMode, part)
      ? null
      : PART_TIME_LIMITS[part] ?? null;
  }
  return MODE_TIME_LIMITS[normalizedMode] ?? null;
}

export function getTimerType(mode, part) {
  return isListeningPart(mode, part)
    ? TIMER_TYPES.ELAPSED
    : TIMER_TYPES.COUNTDOWN;
}

export function getTimerSeconds(attempt, serverNow) {
  if (!attempt?.startedAt) return 0;

  const elapsed = Math.max(0, Math.floor((serverNow - attempt.startedAt) / 1000));
  if (getTimerType(attempt.mode, attempt.selectedPart) === TIMER_TYPES.ELAPSED) {
    return elapsed;
  }

  const duration = getExamDuration(attempt.mode, attempt.selectedPart);
  return duration === null ? 0 : Math.max(0, duration - elapsed);
}

export function isLastListeningUnit(currentUnit, listeningUnits) {
  if (!currentUnit || !listeningUnits?.length) return false;
  return currentUnit.key === listeningUnits[listeningUnits.length - 1].key;
}

export function shouldSubmitAfterListeningAudio(attempt, currentUnit, listeningUnits) {
  if (!isLastListeningUnit(currentUnit, listeningUnits)) return false;
  const mode = normalizeMode(attempt?.mode);
  return mode === "LISTENING"
    || isListeningPart(mode, attempt?.selectedPart);
}
