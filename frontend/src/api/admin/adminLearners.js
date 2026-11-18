import { apiFetch } from "../client";

export function getAdminLearners({ search, pro, size = 20, cursor } = {}, options) {
  const query = new URLSearchParams({ pro, size: String(size) });
  if (search?.trim()) query.set("search", search.trim());
  if (cursor) query.set("cursor", cursor);
  return apiFetch(`/api/admin/users?${query}`, options);
}

export function getAdminLearner(uid, options) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(uid)}`, options);
}

export function getAdminLearnerOrders(uid, { size = 20, cursor } = {}, options) {
  const query = new URLSearchParams({ size: String(size) });
  if (cursor) query.set("cursor", cursor);
  return apiFetch(`/api/admin/users/${encodeURIComponent(uid)}/orders?${query}`, options);
}
