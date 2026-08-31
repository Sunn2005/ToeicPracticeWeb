import { apiFetch } from "./client";

export function getAttemptHistory() {
  return apiFetch("/api/users/me/attempts");
}

export function deleteAttempt(attemptId) {
  return apiFetch(`/api/users/me/attempts/${attemptId}`, {
    method: "DELETE",
  });
}
