import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { API_BASE_URL, clearCsrfToken } from "./client.js";
import { getChatEligibleAttempts, getChatQuestionChoices } from "./userLearning.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
});

function json(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installResponse(response) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return response;
  };
  return calls;
}

test("chat attempt choices derive only identifiers and titles from completed history", async () => {
  const calls = installResponse(json([
    { id: "attempt-1", testId: "test-1", status: "COMPLETED", result: { totalScore: 800 } },
    { id: "attempt-2", testId: "test-2", status: "IN_PROGRESS" },
    { id: "attempt-3", testId: "test-3", status: "COMPLETED", title: "Custom title" },
  ]));

  assert.deepEqual(await getChatEligibleAttempts(), [
    { id: "attempt-1", title: "Test 1" },
    { id: "attempt-3", title: "Custom title" },
  ]);
  assert.equal(calls[0].url, `${API_BASE_URL}/api/users/me/attempts`);
  assert.equal(calls[0].options.credentials, "include");
});

test("chat question choices encode the attempt id and retain question numbers only", async () => {
  const controller = new AbortController();
  const calls = installResponse(json({
    attempt: { id: "attempt/one", answers: { 1: "A" } },
    test: {
      parts: [
        { partNumber: 1, questions: [{ questionNumber: 1, correctAnswer: "A" }] },
        { partNumber: 3, groups: [{ questionRange: "32-34", questions: [{ questionNumber: 32, transcript: "secret" }] }] },
        { partNumber: 5, questions: [{ questionNumber: 101, detailedExplanation: "secret" }] },
      ],
    },
  }));

  const choices = await getChatQuestionChoices("attempt/one ?#", { signal: controller.signal });

  assert.deepEqual(choices, [1, 32, 101]);
  assert.ok(choices.every((choice) => typeof choice === "number"));
  assert.equal(calls[0].url, `${API_BASE_URL}/api/attempts/attempt%2Fone%20%3F%23/review`);
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[0].options.credentials, "include");
});
