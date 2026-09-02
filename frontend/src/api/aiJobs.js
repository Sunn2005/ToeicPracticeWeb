import { apiFetch } from "./client";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 45_000;

export function createAIExplanation(payload, options = {}) {
  return apiFetch("/api/ai/jobs/explanations", {
    ...options,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAIJob(jobId, options = {}) {
  return apiFetch(`/api/ai/jobs/${encodeURIComponent(jobId)}`, options);
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException("Request aborted", "AbortError"));
    };
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function waitForAIJob(
  jobId,
  {
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  } = {},
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await getAIJob(jobId, { signal });
    if (job.status === "SUCCEEDED" || job.status === "FAILED") {
      return job;
    }
    await delay(pollIntervalMs, signal);
  }

  const error = new Error("AI_JOB_TIMEOUT");
  error.code = "AI_JOB_TIMEOUT";
  throw error;
}
