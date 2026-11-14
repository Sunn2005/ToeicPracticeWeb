export const questionsInPart = (part) => [
  ...(part.questions || []),
  ...(part.groups || []).flatMap((group) => group.questions || []),
  ...(part.passages || []).flatMap((passage) => passage.questions || []),
  ...(part.passageGroups || []).flatMap((group) => group.questions || []),
];

export function validateEmployeeTest(test) {
  const errors = [];
  const partCounts = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, 0]));
  const add = (key, values = {}, step = 4, partNumber, questionNumber) => {
    errors.push({ id: `${key}-${errors.length}`, key, values, step, partNumber, questionNumber });
  };
  if (!test?.title?.trim()) add("employeeEditorTitleRequired", {}, 1);
  const parts = test?.parts || [];
  const partNumbers = parts.map((part) => part.partNumber);
  if (parts.length !== 7 || new Set(partNumbers).size !== 7 ||
      partNumbers.some((n) => !Number.isInteger(n) || n < 1 || n > 7)) {
    add("employeeEditorPartsInvalid");
  }

  const numbers = [];
  for (const part of parts) {
    const questions = questionsInPart(part);
    if (part.partNumber in partCounts) partCounts[part.partNumber] += questions.length;
    const labels = part.partNumber === 2 ? ["A", "B", "C"] : ["A", "B", "C", "D"];
    for (const question of questions) {
      const number = question.questionNumber;
      numbers.push(number);
      const values = { part: part.partNumber, question: number ?? "?", labels: labels.join("/"), count: labels.length };
      const step = part.partNumber <= 4 ? 2 : 3;
      const actual = (question.answers || []).map((answer) => answer?.label?.toUpperCase());
      if (actual.length !== labels.length || new Set(actual).size !== labels.length ||
          actual.some((label) => !labels.includes(label))) {
        add("employeeEditorOptionsInvalid", values, step, part.partNumber, number);
      }
      if (!labels.includes(question.correctAnswer?.toUpperCase())) {
        add("employeeEditorCorrectInvalid", values, step, part.partNumber, number);
      }
    }
  }
  if (numbers.length !== 200 || new Set(numbers).size !== 200 ||
      numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 200)) {
    add("employeeEditorNumbersInvalid", { count: numbers.length });
  }
  return { errors, partCounts, totalActualQuestions: numbers.length };
}

// Accept unsaved data from the original editor, but always write the API schema.
export function normalizePassage(passage) {
  const fields = { ...passage };
  delete fields.text;
  delete fields.passages;
  delete fields.translation;
  return { ...fields, content: passage.content ?? passage.text ?? passage.passages?.[0]?.content ?? passage.passages?.[0]?.text ?? "" };
}

export function normalizeEditorTest(test) {
  return {
    ...test,
    parts: (test.parts || []).map((part) => {
      if (part.partNumber === 6) return { ...part, passages: (part.passages || []).map(normalizePassage) };
      if (part.partNumber === 7) return {
        ...part,
        passageGroups: (part.passageGroups || []).map((group) => ({
          ...group, passages: (group.passages || []).map(normalizePassage),
        })),
      };
      return part;
    }),
  };
}

export function employeeTestPayload(test) {
  const normalized = normalizeEditorTest(test);
  return Object.fromEntries([
    "title", "description", "type", "totalQuestions", "listeningMinutes",
    "readingMinutes", "totalMinutes", "parts",
  ].filter((key) => normalized[key] !== undefined).map((key) => [key, normalized[key]]));
}

export async function saveEmployeeDraft(test, { create, update }) {
  const payload = employeeTestPayload(test);
  return test.testId ? update(test.testId, payload) : create(payload);
}

export async function saveAndSubmitEmployeeTest(test, api) {
  if (validateEmployeeTest(test).errors.length) throw new Error("employeeEditorCannotSubmit");
  const saved = await saveEmployeeDraft(test, api);
  if (!saved?.testId) throw new Error("employeeEditorMissingSavedId");
  api.onSaved?.(saved);
  return api.submit(saved.testId);
}
