import { apiFetch } from "./client.js";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const TERMINAL_JOB_STATUSES = new Set(["SUCCEEDED", "FAILED"]);

export function listConversations(options = {}) {
  return apiFetch("/api/ai/chat/conversations", options);
}

export function createConversation(payload, options = {}) {
  return apiFetch("/api/ai/chat/conversations", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getConversation(conversationId, options = {}) {
  return apiFetch(
    `/api/ai/chat/conversations/${encodeURIComponent(conversationId)}`,
    options,
  );
}

export function sendChatMessage(conversationId, payload, options = {}) {
  return apiFetch(
    `/api/ai/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      ...options,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteConversation(conversationId, options = {}) {
  return apiFetch(
    `/api/ai/chat/conversations/${encodeURIComponent(conversationId)}`,
    { ...options, method: "DELETE" },
  );
}

export function getChatJob(jobId, options = {}) {
  return apiFetch(`/api/ai/chat/jobs/${encodeURIComponent(jobId)}`, options);
}

function abortError() {
  return new DOMException("Request aborted", "AbortError");
}

function delay(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      reject(abortError());
    };
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function waitForChatJob(
  jobId,
  {
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = {},
) {
  if (signal?.aborted) throw abortError();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw abortError();
    const job = await getChatJob(jobId, { signal });
    if (TERMINAL_JOB_STATUSES.has(job.status)) return job;
    await delay(pollIntervalMs, signal);
  }

  const error = new Error("CHAT_JOB_TIMEOUT");
  error.code = "CHAT_JOB_TIMEOUT";
  throw error;
}
