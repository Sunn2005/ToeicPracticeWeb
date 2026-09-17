import { apiFetch } from "./client";

export function requestAttemptAIAnalysis(attemptId, options = {}) {
  return apiFetch(`/api/attempts/${encodeURIComponent(attemptId)}/ai-analysis`, {
    ...options,
    method: "POST",
  });
}

export function getAttemptAIAnalysis(attemptId, options = {}) {
  return apiFetch(`/api/attempts/${encodeURIComponent(attemptId)}/ai-analysis`, options);
}
