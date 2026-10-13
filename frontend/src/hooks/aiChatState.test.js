import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_CHAT_ACTIONS,
  aiChatReducer,
  conversationIdToResume,
  createInitialAIChatState,
  pendingJobIdsFromMessages,
} from "./aiChatState.js";

const conversation = {
  id: "conversation-1",
  title: "New TOEIC conversation",
  locale: "en",
  status: "ACTIVE",
};

const accepted = {
  userMessage: {
    id: "user-1",
    role: "USER",
    content: "Why is despite correct?",
    status: "SUCCEEDED",
    jobId: "job-1",
  },
  assistantMessage: {
    id: "assistant-1",
    role: "ASSISTANT",
    content: null,
    status: "PENDING",
    jobId: "job-1",
  },
  job: { id: "job-1", conversationId: "conversation-1", status: "PENDING" },
  quotaSummary: { dailyLimit: 30, remainingDaily: 29, nextResetAt: 1_800_000_000_000 },
};

function reduce(state, type, payload = {}) {
  return aiChatReducer(state, { type, ...payload });
}

test("conversation loading has deterministic loading, empty, ready, and error states", () => {
  const initial = createInitialAIChatState();
  const loading = reduce(initial, AI_CHAT_ACTIONS.LOAD_STARTED);
  const empty = reduce(loading, AI_CHAT_ACTIONS.LOAD_SUCCEEDED, { conversations: [] });
  const ready = reduce(loading, AI_CHAT_ACTIONS.LOAD_SUCCEEDED, { conversations: [conversation] });
  const failed = reduce(loading, AI_CHAT_ACTIONS.LOAD_FAILED, {
    errorCode: "CHAT_LOAD_FAILED",
    errorMessage: "network unavailable",
  });

  assert.equal(loading.status, "loading");
  assert.equal(empty.status, "empty");
  assert.equal(ready.status, "ready");
  assert.deepEqual(ready.conversations, [conversation]);
  assert.equal(failed.status, "error");
  assert.equal(failed.errorCode, "CHAT_LOAD_FAILED");
  assert.equal(failed.errorMessage, "network unavailable");
});

test("accepted messages update quota and add one pending job", () => {
  const opened = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation, messages: [] },
  });
  const next = reduce(opened, AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, { accepted });

  assert.deepEqual(next.messages.map((message) => message.id), ["user-1", "assistant-1"]);
  assert.deepEqual(next.pendingJobIds, ["job-1"]);
  assert.equal(next.quota.remainingDaily, 29);
  assert.equal(next.sending, false);
});

test("an accepted response never appends messages to a different active conversation", () => {
  const secondConversation = { ...conversation, id: "conversation-2" };
  const opened = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation: secondConversation, messages: [] },
  });

  const next = reduce(opened, AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, {
    accepted,
    conversationId: conversation.id,
  });

  assert.equal(next.activeConversationId, secondConversation.id);
  assert.deepEqual(next.messages, []);
  assert.deepEqual(next.pendingJobIds, []);
  assert.equal(next.quota.remainingDaily, 29);
  assert.equal(next.sending, false);
});

test("creating a conversation clears the mutation lock and opens an empty thread", () => {
  const sending = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.SEND_STARTED);
  const created = reduce(sending, AI_CHAT_ACTIONS.CONVERSATION_CREATED, { conversation });

  assert.equal(created.sending, false);
  assert.equal(created.activeConversationId, conversation.id);
  assert.deepEqual(created.messages, []);
});

test("idempotent accepted or terminal updates never duplicate displayed messages", () => {
  const opened = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation, messages: [] },
  });
  const once = reduce(opened, AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, { accepted });
  const retriedAcceptance = reduce(once, AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, { accepted });
  const completedDetail = {
    conversation,
    messages: [
      accepted.userMessage,
      { ...accepted.assistantMessage, content: "Despite is followed by a noun phrase.", status: "SUCCEEDED" },
    ],
  };
  const completed = reduce(retriedAcceptance, AI_CHAT_ACTIONS.CONVERSATION_SYNCED, {
    detail: completedDetail,
  });
  const deliveredAgain = reduce(completed, AI_CHAT_ACTIONS.CONVERSATION_SYNCED, {
    detail: completedDetail,
  });

  assert.equal(retriedAcceptance.messages.length, 2);
  assert.equal(deliveredAgain.messages.length, 2);
  assert.equal(deliveredAgain.messages[1].status, "SUCCEEDED");
  assert.deepEqual(deliveredAgain.pendingJobIds, []);
});

test("a failed assistant retry keeps the original question visible only once", () => {
  const failedAssistant = {
    ...accepted.assistantMessage,
    status: "FAILED",
    errorCode: "AI_UNAVAILABLE",
  };
  const retryAccepted = {
    ...accepted,
    userMessage: { ...accepted.userMessage, id: "user-2", jobId: "job-2" },
    assistantMessage: { ...accepted.assistantMessage, id: "assistant-2", jobId: "job-2" },
    job: { ...accepted.job, id: "job-2" },
  };
  const opened = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation, messages: [accepted.userMessage, failedAssistant] },
  });
  const retried = reduce(opened, AI_CHAT_ACTIONS.MESSAGE_ACCEPTED, { accepted: retryAccepted });

  assert.deepEqual(retried.messages.map(({ id }) => id), ["user-1", "assistant-2"]);
  assert.deepEqual(retried.pendingJobIds, ["job-2"]);
});

test("deleting the active conversation clears its messages and chooses the next conversation", () => {
  const second = { ...conversation, id: "conversation-2" };
  let state = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.LOAD_SUCCEEDED, {
    conversations: [conversation, second],
  });
  state = reduce(state, AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation, messages: [accepted.userMessage] },
  });
  state = reduce(state, AI_CHAT_ACTIONS.CONVERSATION_DELETED, {
    conversationId: conversation.id,
  });

  assert.deepEqual(state.conversations, [second]);
  assert.equal(state.activeConversationId, second.id);
  assert.deepEqual(state.messages, []);
  assert.deepEqual(state.pendingJobIds, []);
});

test("PRO_REQUIRED disables sending without deleting visible history", () => {
  const opened = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation, messages: [accepted.userMessage] },
  });
  const expired = reduce(opened, AI_CHAT_ACTIONS.REQUEST_FAILED, {
    errorCode: "PRO_REQUIRED",
    errorMessage: "Pro expired",
  });

  assert.equal(expired.canSend, false);
  assert.equal(expired.errorCode, "PRO_REQUIRED");
  assert.deepEqual(expired.messages, [accepted.userMessage]);
  assert.equal(expired.activeConversationId, conversation.id);
});

test("pending job recovery keeps only unique pending assistant jobs", () => {
  assert.deepEqual(pendingJobIdsFromMessages([
    accepted.userMessage,
    accepted.assistantMessage,
    { ...accepted.assistantMessage, id: "assistant-copy" },
    { ...accepted.assistantMessage, id: "assistant-failed", jobId: "job-2", status: "FAILED" },
    { ...accepted.assistantMessage, id: "assistant-2", jobId: "job-3" },
  ]), ["job-1", "job-3"]);

  const resumed = reduce(createInitialAIChatState(), AI_CHAT_ACTIONS.CONVERSATION_OPENED, {
    detail: { conversation, messages: [accepted.userMessage, accepted.assistantMessage] },
  });
  assert.deepEqual(resumed.pendingJobIds, ["job-1"]);
});

test("reopening selects the retained active conversation only when it still exists", () => {
  const second = { ...conversation, id: "conversation-2" };

  assert.equal(conversationIdToResume([conversation, second], second.id), second.id);
  assert.equal(conversationIdToResume([conversation], second.id), null);
  assert.equal(conversationIdToResume([conversation], null), null);
});
