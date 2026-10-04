import { apiFetch } from "./client.js";

export function getSubscription(uid) {
  return apiFetch(`/api/admin/subscriptions/${encodeURIComponent(uid)}`);
}

export function upsertSubscription(uid, expiresAt) {
  return apiFetch(`/api/admin/subscriptions/${encodeURIComponent(uid)}`, {
    method: "PUT",
    body: JSON.stringify({ expiresAt }),
  });
}

export function revokeSubscription(uid) {
  return apiFetch(`/api/admin/subscriptions/${encodeURIComponent(uid)}`, {
    method: "DELETE",
  });
}
