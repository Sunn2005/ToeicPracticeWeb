import { apiFetch } from "./client";

export function getEmployeeTests() {
  return apiFetch("/api/employee/tests");
}

export function getEmployeeTest(testId) {
  return apiFetch(`/api/employee/tests/${encodeURIComponent(testId)}`);
}

export function createEmployeeTest(test) {
  return apiFetch("/api/employee/tests", {
    method: "POST",
    body: JSON.stringify(test),
  });
}

export function updateEmployeeTest(testId, test) {
  return apiFetch(`/api/employee/tests/${encodeURIComponent(testId)}`, {
    method: "PUT",
    body: JSON.stringify(test),
  });
}

export function deleteEmployeeTest(testId) {
  return apiFetch(`/api/employee/tests/${encodeURIComponent(testId)}`, {
    method: "DELETE",
  });
}

export function submitEmployeeTest(testId) {
  return apiFetch(`/api/employee/tests/${encodeURIComponent(testId)}/submit`, {
    method: "POST",
  });
}

export function uploadEmployeeMedia(file) {
  const body = new FormData();
  body.append("file", file);
  return apiFetch("/api/employee/media", { method: "POST", body });
}
