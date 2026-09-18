import { apiFetch } from "./client";

export function requestAttemptAIAnalysis(attemptId, { refresh = false, ...options } = {}) {
  const query = refresh ? "?refresh=true" : "";
  return apiFetch(`/api/attempts/${encodeURIComponent(attemptId)}/ai-analysis${query}`, {
    ...options,
    method: "POST",
  });
}

export function getAttemptAIAnalysis(attemptId, options = {}) {
  return apiFetch(`/api/attempts/${encodeURIComponent(attemptId)}/ai-analysis`, options);
}
