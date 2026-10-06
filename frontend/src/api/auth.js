import {
  apiFetch,
  clearCsrfToken,
  getCsrfToken,
} from "./client.js";

export { clearCsrfToken, getCsrfToken };

export async function createSession(idToken) {
  const profile = await apiFetch("/api/v1/auth/session", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  clearCsrfToken();
  return profile;
}

export async function destroySession() {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } finally {
    clearCsrfToken();
  }
}
