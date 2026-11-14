import test from "node:test";
import assert from "node:assert/strict";
import { generateMockToeicTest } from "../../utils/mockToeicTest.js";
import { buildReadingUnits } from "../../../exam/utils/testData.js";
import {
  employeeTestPayload, normalizeEditorTest, questionsInPart, renumberEmployeeTest,
  validateEmployeeTest, saveAndSubmitEmployeeTest,
} from "./testEditorState.js";

test("sample has 200 valid questions with A/B/C in Part 2 and persistent reading content", () => {
  const sample = generateMockToeicTest();
  assert.deepEqual(validateEmployeeTest(sample).errors, []);
  assert.equal(validateEmployeeTest(sample).totalActualQuestions, 200);
  const payload = employeeTestPayload(sample);
  for (const unit of buildReadingUnits(payload).filter((u) => u.partNumber >= 6)) {
    assert.ok(unit.passages.every((p) => p.content?.length > 0));
    assert.ok(unit.passages.every((p) => !("text" in p)));
  }
});

test("sample listening slots always carry a media URL", () => {
  const sample = generateMockToeicTest();
  for (const part of sample.parts) {
    if (part.partNumber <= 2) {
      for (const question of part.questions) {
        assert.ok(question.audioUrl, `Part ${part.partNumber} question ${question.questionNumber} is missing audioUrl`);
      }
    }
    if (part.partNumber === 1) {
      for (const question of part.questions) {
        assert.ok(question.imageUrl, `Part 1 question ${question.questionNumber} is missing imageUrl`);
      }
    }
    if (part.partNumber === 3 || part.partNumber === 4) {
      for (const group of part.groups) {
        assert.ok(group.audioUrl, `Part ${part.partNumber} group is missing audioUrl`);
      }
    }
  }
});

test("renumber restores continuous numbering after a mid-test deletion", () => {
  const sample = generateMockToeicTest();
  sample.parts[0].questions.splice(2, 1); // drop question 3: leaves a gap
  assert.ok(validateEmployeeTest(sample).errors.some((e) => e.key === "employeeEditorNumbersInvalid"));
  const fixed = renumberEmployeeTest(sample);
  const numbers = fixed.parts.flatMap((part) => questionsInPart(part).map((q) => q.questionNumber));
  assert.deepEqual(numbers, Array.from({ length: 199 }, (_, i) => i + 1));
  const group = fixed.parts[2].groups[0];
  assert.equal(group.questionRange, `${group.questions[0].questionNumber}-${group.questions.at(-1).questionNumber}`);
});

test("renumber makes a complete test with scrambled numbers valid again", () => {
  const sample = generateMockToeicTest();
  for (const part of sample.parts) {
    for (const question of questionsInPart(part)) question.questionNumber = 999;
  }
  assert.ok(validateEmployeeTest(sample).errors.some((e) => e.key === "employeeEditorNumbersInvalid"));
  assert.deepEqual(validateEmployeeTest(renumberEmployeeTest(sample)).errors, []);
});

test("rejects Part 2 D, four options, duplicate labels and missing correct answers", () => {
  for (const change of [
    (q) => { q.correctAnswer = "D"; },
    (q) => { q.answers.push({ label: "D", content: "extra" }); },
    (q) => { q.answers[2].label = "A"; },
    (q) => { q.correctAnswer = ""; },
  ]) {
    const sample = generateMockToeicTest();
    change(sample.parts[1].questions[0]);
    assert.ok(validateEmployeeTest(sample).errors.length);
  }
  const sample = generateMockToeicTest();
  sample.parts[0].questions[0].answers.pop();
  assert.ok(validateEmployeeTest(sample).errors.some((e) => e.key === "employeeEditorOptionsInvalid"));
});

test("rejects missing/duplicate Parts, incomplete question sets, duplicates and out-of-range numbering", () => {
  for (const change of [
    (t) => { t.parts.pop(); },
    (t) => { t.parts[1].partNumber = 1; },
    (t) => { t.parts[0].questions.pop(); },
    (t) => { t.parts[0].questions[0].questionNumber = 2; },
    (t) => { t.parts[0].questions[0].questionNumber = 201; },
  ]) {
    const sample = generateMockToeicTest();
    change(sample);
    assert.ok(validateEmployeeTest(sample).errors.length);
  }
});

test("normalizes legacy reading data without losing canonical content, image or metadata", () => {
  const original = {
    title: "Test", status: "REJECTED", createdBy: "server-owner", reviewedBy: "admin", testId: "draft",
    parts: [
      { partNumber: 6, passages: [{ passageNumber: 1, title: "Notice", content: "Existing", text: "Stale", imageUrl: "https://example.com/image.png", questions: [] }] },
      { partNumber: 7, passageGroups: [{ groupNumber: 1, imageUrls: ["https://example.com/group.png"], passages: [{ text: "Legacy" }], questions: [] }] },
    ],
  };
  const payload = employeeTestPayload(original);
  assert.equal(payload.parts[0].passages[0].content, "Existing");
  assert.equal(payload.parts[0].passages[0].imageUrl, original.parts[0].passages[0].imageUrl);
  assert.equal(payload.parts[1].passageGroups[0].passages[0].content, "Legacy");
  for (const key of ["testId", "createdBy", "status", "reviewedBy"]) assert.equal(key in payload, false);
  assert.equal(original.parts[1].passageGroups[0].passages[0].text, "Legacy");
  assert.deepEqual(normalizeEditorTest(payload).parts, payload.parts);
});

test("save failures stop submission for both new and existing drafts", async () => {
  for (const testId of [undefined, "existing"]) {
    let submits = 0;
    const fail = async () => { throw new Error("save failed"); };
    await assert.rejects(saveAndSubmitEmployeeTest({ ...generateMockToeicTest(), testId }, {
      create: fail, update: fail, submit: async () => { submits += 1; },
    }), /save failed/);
    assert.equal(submits, 0);
  }
});

test("submit waits for save, retains saved ID before submit failure, and retries as update", async () => {
  const calls = [];
  let draft = generateMockToeicTest();
  const api = {
    create: async (payload) => { calls.push("create"); return { ...payload, testId: "saved" }; },
    update: async (id, payload) => { calls.push(`update:${id}`); return { ...payload, testId: id }; },
    onSaved: (saved) => { draft = saved; calls.push("saved"); },
    submit: async (id) => { calls.push(`submit:${id}`); throw new Error("submit failed"); },
  };
  await assert.rejects(saveAndSubmitEmployeeTest(draft, api), /submit failed/);
  await assert.rejects(saveAndSubmitEmployeeTest(draft, api), /submit failed/);
  assert.deepEqual(calls, ["create", "saved", "submit:saved", "update:saved", "saved", "submit:saved"]);
});

test("invalid data and missing save IDs never reach submit", async () => {
  let saves = 0;
  let submits = 0;
  const api = {
    create: async () => { saves += 1; return {}; },
    submit: async () => { submits += 1; },
  };
  await assert.rejects(saveAndSubmitEmployeeTest({ title: "Draft", parts: [] }, api), /employeeEditorCannotSubmit/);
  assert.equal(saves, 0);
  await assert.rejects(saveAndSubmitEmployeeTest(generateMockToeicTest(), api), /employeeEditorMissingSavedId/);
  assert.equal(submits, 0);
});
