export function getAttemptParts(attempt) {
  if (attempt?.selectedParts?.length) return attempt.selectedParts;
  if (attempt?.selectedPart) return [attempt.selectedPart];
  if (attempt?.mode === "LISTENING") return [1, 2, 3, 4];
  if (attempt?.mode === "READING") return [5, 6, 7];
  return [1, 2, 3, 4, 5, 6, 7];
}

export function getAttemptDurationSeconds(attempt) {
  const startedAt = Number(attempt?.startedAt) || 0;
  const endedAt = Number(attempt?.submittedAt || attempt?.updatedAt) || startedAt;
  return Math.max(0, Math.round((endedAt - startedAt) / 1000));
}

export function getHistoryStats(attempts) {
  const completed = attempts.filter((attempt) => attempt.status === "COMPLETED");
  const totalCorrect = completed.reduce(
    (sum, attempt) => sum + (Number(attempt.result?.totalCorrect) || 0),
    0,
  );
  const totalQuestions = completed.reduce(
    (sum, attempt) => sum + (Number(attempt.result?.totalQuestions) || 0),
    0,
  );
  const accuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const activeDays = new Set(completed.map((attempt) => {
    const timestamp = Number(attempt.submittedAt || attempt.updatedAt || attempt.startedAt);
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? null
      : `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }).filter(Boolean));

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(`${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { completed: completed.length, accuracy, streak };
}
