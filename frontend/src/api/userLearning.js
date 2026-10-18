import { apiFetch } from "./client.js";
import { getTestName } from "../data/testCatalog.js";
import { getAllQuestions } from "../utils/testData.js";

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

export async function getChatEligibleAttempts(options = {}) {
  const attempts = await apiFetch("/api/users/me/attempts", options);
  return (attempts || [])
    .filter((attempt) => attempt?.id && ["COMPLETED", "IN_PROGRESS"].includes(attempt.status))
    .map((attempt) => ({
      id: attempt.id,
      title: attempt.title || attempt.testTitle || getTestName(attempt.testId),
      status: attempt.status,
      score: attempt.score,
      submittedAt: attempt.submittedAt,
      type: attempt.type,
      selectedPart: attempt.selectedPart,
      selectedParts: attempt.selectedParts,
    }));
}

export async function getChatQuestionChoices(attemptId, options = {}) {
  const review = await apiFetch(
    `/api/attempts/${encodeURIComponent(attemptId)}/review`,
    options,
  );
  return [...new Set(getAllQuestions(review?.test)
    .map(({ question }) => Number(question.questionNumber))
    .filter(Number.isInteger))]
    .sort((left, right) => left - right);
}

export function deleteAttempt(attemptId) {
  return apiFetch(`/api/users/me/attempts/${attemptId}`, {
    method: "DELETE",
  });
}
