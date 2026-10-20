import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { API_BASE_URL, clearCsrfToken } from "./client.js";
import {
  createConversation,
  deleteConversation,
  getChatJob,
  getConversation,
  listConversations,
  retryChatMessage,
  renameConversation,
  sendChatMessage,
  waitForChatJob,
} from "./aiChat.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearCsrfToken();
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installResponses(...responses) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.ok(responses.length, `Unexpected request to ${url}`);
    return responses.shift();
  };
  return calls;
}

test("conversation reads use protected GET requests and encode identifiers", async () => {
  const calls = installResponses(json([]), json({ conversation: {}, messages: [] }));

  assert.deepEqual(await listConversations(), []);
  await getConversation("conversation/with space?#");

  assert.equal(calls[0].url, `${API_BASE_URL}/api/ai/chat/conversations`);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(
    calls[1].url,
    `${API_BASE_URL}/api/ai/chat/conversations/conversation%2Fwith%20space%3F%23`,
  );
  assert.equal(calls[1].options.credentials, "include");
});

test("conversation mutations send exact methods and body shapes", async () => {
  const calls = installResponses(
    json({ token: "csrf" }),
    json({ id: "conversation" }, 201),
    json({ userMessage: {}, assistantMessage: {}, job: { id: "job" } }, 202),
    json({ id: "conversation", title: "Mẹo Part 5" }),
    new Response(null, { status: 204 }),
  );

  await createConversation({ locale: "vi", attemptId: "attempt-1", questionNumber: 101 });
  await sendChatMessage("conversation/one", {
    content: "Giải thích câu này",
    idempotencyKey: "message-key",
  });
  await renameConversation("conversation/one", "Mẹo Part 5");
  assert.equal(await deleteConversation("conversation/one"), null);

  assert.equal(calls[1].url, `${API_BASE_URL}/api/ai/chat/conversations`);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    locale: "vi",
    attemptId: "attempt-1",
    questionNumber: 101,
  });
  assert.equal(calls[1].options.credentials, "include");

  assert.equal(
    calls[2].url,
    `${API_BASE_URL}/api/ai/chat/conversations/conversation%2Fone/messages`,
  );
  assert.equal(calls[2].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    content: "Giải thích câu này",
    idempotencyKey: "message-key",
  });

  assert.equal(calls[3].url, `${API_BASE_URL}/api/ai/chat/conversations/conversation%2Fone`);
  assert.equal(calls[3].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[3].options.body), { title: "Mẹo Part 5" });

  assert.equal(
    calls[4].url,
    `${API_BASE_URL}/api/ai/chat/conversations/conversation%2Fone`,
  );
  assert.equal(calls[4].options.method, "DELETE");
  assert.equal(calls[4].options.body, undefined);
});

test("retrying a failed assistant message posts to the retry endpoint", async () => {
  const calls = installResponses(
    json({ token: "csrf" }),
    json({
      userMessage: { id: "user-1" },
      assistantMessage: { id: "assistant-1", status: "PENDING" },
      job: { id: "retry-job" },
      newlyAccepted: true,
    }, 202),
  );

  const accepted = await retryChatMessage("conversation/one", "assistant/1");

  assert.equal(accepted.job.id, "retry-job");
  assert.equal(
    calls[1].url,
    `${API_BASE_URL}/api/ai/chat/conversations/conversation%2Fone/messages/assistant%2F1/retry`,
  );
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.body, undefined);
  assert.equal(calls[1].options.credentials, "include");
});

test("job reads encode identifiers and polling returns the first terminal state", async () => {
  const calls = installResponses(
    json({ id: "job", status: "PENDING" }),
    json({ id: "job", status: "SUCCEEDED" }),
  );

  const job = await waitForChatJob("job/one", { pollIntervalMs: 0, timeoutMs: 1_000 });

  assert.equal(job.status, "SUCCEEDED");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, `${API_BASE_URL}/api/ai/chat/jobs/job%2Fone`);
  assert.equal(calls[0].options.credentials, "include");
});

test("direct job reads preserve AbortSignal through apiFetch", async () => {
  const controller = new AbortController();
  const calls = installResponses(json({ id: "job", status: "FAILED" }));

  await getChatJob("job", { signal: controller.signal });

  assert.equal(calls[0].options.signal, controller.signal);
});

test("polling reports a stable timeout code", async () => {
  await assert.rejects(
    () => waitForChatJob("job", { timeoutMs: 0, pollIntervalMs: 0 }),
    (error) => error.code === "CHAT_JOB_TIMEOUT",
  );
});

test("polling rejects an already-aborted signal before making a request", async () => {
  const controller = new AbortController();
  controller.abort();
  const calls = installResponses();

  await assert.rejects(
    () => waitForChatJob("job", { signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
  assert.equal(calls.length, 0);
});
