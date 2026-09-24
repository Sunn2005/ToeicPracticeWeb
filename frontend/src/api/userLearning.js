import { apiFetch } from "./client";

const HISTORY_CACHE_PREFIX = "capytoeic:attempt-history:";

export function readAttemptHistoryCache(uid) {
  if (!uid) return null;
  try {
    const raw = window.sessionStorage.getItem(`${HISTORY_CACHE_PREFIX}${uid}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAttemptHistoryCache(uid, history) {
  if (!uid || !Array.isArray(history)) return;
  try {
    window.sessionStorage.setItem(
      `${HISTORY_CACHE_PREFIX}${uid}`,
      JSON.stringify(history),
    );
  } catch {
    // Private browsing can reject storage. The in-memory list still works.
  }
}

export function getAttemptHistory() {
  return apiFetch("/api/users/me/attempts");
}

export function deleteAttempt(attemptId) {
  return apiFetch(`/api/users/me/attempts/${attemptId}`, {
    method: "DELETE",
  });
}
