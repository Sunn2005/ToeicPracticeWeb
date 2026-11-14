import { apiFetch } from "../client.js";

export function exitAttempt(attemptId) {
  return apiFetch(`/api/attempts/${encodeURIComponent(attemptId)}/exit`, { method: "POST" });
}

export function resumePracticeAttempt(attemptId) {
  return apiFetch(`/api/attempts/${encodeURIComponent(attemptId)}/resume`, { method: "POST" });
}
