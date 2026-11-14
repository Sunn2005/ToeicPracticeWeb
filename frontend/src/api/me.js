import { apiFetch } from "./client.js";

export function updateProfile(profile) {
  return apiFetch("/api/me", {
    method: "PATCH",
    body: JSON.stringify(profile),
  });
}
