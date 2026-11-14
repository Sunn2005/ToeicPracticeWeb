import assert from "node:assert/strict";
import test from "node:test";
import {
  createChatSendAttemptRegistry,
  isConfirmedHttpFailure,
} from "./aiChatSendAttempts.js";

test("an unknown transport outcome reuses the same key for the same logical message", () => {
  let sequence = 0;
  const attempts = createChatSendAttemptRegistry(() => `key-${++sequence}`);

  const first = attempts.prepare("conversation-1", "Explain despite");
  const retried = attempts.prepare("conversation-1", "Explain despite");

  assert.equal(first.idempotencyKey, "key-1");
  assert.equal(retried.idempotencyKey, "key-1");
  assert.equal(sequence, 1);
});

test("accepted and confirmed rejected attempts clear the retained key", () => {
  let sequence = 0;
  const attempts = createChatSendAttemptRegistry(() => `key-${++sequence}`);

  const accepted = attempts.prepare("conversation-1", "First");
  attempts.clear(accepted);
  assert.equal(attempts.prepare("conversation-1", "First").idempotencyKey, "key-2");

  const rejected = attempts.prepare("conversation-2", "Second");
  attempts.clear(rejected);
  assert.equal(attempts.prepare("conversation-2", "Second").idempotencyKey, "key-4");
});

test("only an HTTP response proves that the server rejected a send", () => {
  assert.equal(isConfirmedHttpFailure({ status: 409 }), true);
  assert.equal(isConfirmedHttpFailure({ status: 503 }), true);
  assert.equal(isConfirmedHttpFailure(new TypeError("Failed to fetch")), false);
  assert.equal(isConfirmedHttpFailure({ name: "AbortError" }), false);
});

test("a different payload or conversation starts a new logical attempt", () => {
  let sequence = 0;
  const attempts = createChatSendAttemptRegistry(() => `key-${++sequence}`);

  assert.equal(attempts.prepare("conversation-1", "First").idempotencyKey, "key-1");
  assert.equal(attempts.prepare("conversation-1", "Edited").idempotencyKey, "key-2");
  assert.equal(attempts.prepare("conversation-2", "Edited").idempotencyKey, "key-3");
});
