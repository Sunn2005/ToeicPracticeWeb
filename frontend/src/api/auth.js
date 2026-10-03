import {
  apiFetch,
  clearCsrfToken,
  getCsrfToken,
} from "./client.js";

export { clearCsrfToken, getCsrfToken };

export function createSession(idToken) {
  return apiFetch("/api/v1/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export async function destroySession() {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } finally {
    clearCsrfToken();
  }
}
