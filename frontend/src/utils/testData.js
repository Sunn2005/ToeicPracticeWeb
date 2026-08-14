export function buildListeningUnits(test) {
  const parts = test?.parts || [];
  return parts
    .filter((part) => part.partNumber <= 4)
    .flatMap((part) => {
      if (Array.isArray(part.questions)) {
        return part.questions.map((question) => ({
          key: `listening-${question.questionNumber}`,
          partNumber: part.partNumber,
          partName: part.name,
          start: question.questionNumber,
          end: question.questionNumber,
          questions: [question],
          audioUrl: question.audioUrl,
          imageUrl: question.imageUrl,
          transcript: question.transcript,
        }));
      }

      return (part.groups || []).map((group) => ({
        ...group,
        key: `listening-${group.questionRange}`,
        partNumber: part.partNumber,
        partName: part.name,
        start: group.questions[0]?.questionNumber,
        end: group.questions.at(-1)?.questionNumber,
      }));
    });
}

export function buildReadingUnits(test) {
  const parts = test?.parts || [];
  return parts
    .filter((part) => part.partNumber >= 5)
    .flatMap((part) => {
      if (part.partNumber === 5) {
        return (part.questions || []).map((question) => ({
          key: `reading-${question.questionNumber}`,
          partNumber: part.partNumber,
          partName: part.name,
          start: question.questionNumber,
          end: question.questionNumber,
          questions: [question],
        }));
      }

      if (part.partNumber === 6) {
        return (part.passages || []).map((passage) => ({
          ...passage,
          key: `reading-part6-${passage.passageNumber}`,
          partNumber: part.partNumber,
          partName: part.name,
          passages: [passage],
          start: passage.questions[0]?.questionNumber,
          end: passage.questions.at(-1)?.questionNumber,
        }));
      }

      return (part.passageGroups || []).map((group) => ({
        ...group,
        key: `reading-part7-${group.groupNumber}`,
        partNumber: part.partNumber,
        partName: part.name,
        start: group.questions[0]?.questionNumber,
        end: group.questions.at(-1)?.questionNumber,
      }));
    });
}

export function buildAllUnits(test) {
  return [...buildListeningUnits(test), ...buildReadingUnits(test)];
}

export function findUnit(units, questionNumber) {
  return units.find(
    (unit) => questionNumber >= unit.start && questionNumber <= unit.end,
  );
}

export function getAllQuestions(test) {
  return buildAllUnits(test)
    .flatMap((unit) =>
      unit.questions.map((question) => ({
        question,
        unit,
        partNumber: unit.partNumber,
      })),
    )
    .sort((a, b) => a.question.questionNumber - b.question.questionNumber);
}

export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours} giờ ${minutes} phút ${remainder} giây`;
  }
  return `${minutes} phút ${remainder} giây`;
}
