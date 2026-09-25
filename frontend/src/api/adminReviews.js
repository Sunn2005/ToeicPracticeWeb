import { apiFetch } from "./client";

export function getPendingSubmissions() {
  return apiFetch("/api/admin/test-submissions");
}

export function getSubmission(testId) {
  return apiFetch(`/api/admin/test-submissions/${encodeURIComponent(testId)}`);
}

export function approveSubmission(testId) {
  return apiFetch(
    `/api/admin/test-submissions/${encodeURIComponent(testId)}/approve`,
    { method: "POST" },
  );
}

export function rejectSubmission(testId, reason) {
  return apiFetch(
    `/api/admin/test-submissions/${encodeURIComponent(testId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
}

export function getReviewHistory() {
  return apiFetch("/api/admin/review-history");
}
