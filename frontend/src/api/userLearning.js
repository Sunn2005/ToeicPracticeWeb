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

export function getStatistics() {
  return apiFetch("/api/users/me/statistics");
}

export function updateUserProfile({ displayName, photoUrl, targetScore, phoneNumber, dateOfBirth, gender }) {
  return apiFetch("/api/me", {
    method: "PATCH",
    body: JSON.stringify({ displayName, photoUrl, targetScore, phoneNumber, dateOfBirth, gender }),
  });
}

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function dayNumberInVietnam(timestamp) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / 86400000;
}

export function computeStudyStreak(attempts) {
  const days = new Set(
    (attempts || [])
      .filter((attempt) => attempt?.status === "COMPLETED" && attempt?.submittedAt)
      .map((attempt) => dayNumberInVietnam(attempt.submittedAt)),
  );
  if (days.size === 0) return 0;
  let cursor = dayNumberInVietnam(Date.now());
  if (!days.has(cursor)) cursor -= 1; // hôm nay chưa học thì tính chuỗi từ hôm qua
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export function aggregatePartAccuracy(attempts) {
  const accuracy = {};
  for (const attempt of attempts || []) {
    if (attempt?.status !== "COMPLETED" || !attempt?.result) continue;
    const part = attempt.selectedPart;
    if (!Number.isInteger(part) || part < 1 || part > 7) continue;
    const questions = Number(attempt.result.totalQuestions) || 0;
    const correct = Number(attempt.result.correctCount ?? attempt.result.totalCorrect) || 0;
    if (questions <= 0) continue;
    if (!accuracy[part]) accuracy[part] = { correct: 0, questions: 0 };
    accuracy[part].correct += correct;
    accuracy[part].questions += questions;
  }
  return accuracy;
}

