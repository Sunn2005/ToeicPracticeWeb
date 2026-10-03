import { apiFetch, publicApiFetch } from "./client.js";

export function loadPracticePart(testId, partId, request = publicApiFetch) {
  return request(
    `/api/tests/${encodeURIComponent(testId)}/parts/${encodeURIComponent(partId)}`,
  );
}

export function startPracticeAttempt(testId, request = apiFetch) {
  return request("/api/attempts", {
    method: "POST",
    body: JSON.stringify({ testId }),
  });
}
