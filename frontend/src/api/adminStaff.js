import { apiFetch } from "./client";

const base = "/api/admin/staff";
export const getStaffDirectory = (options) => apiFetch(base, options);
export const lookupStaffAccount = (email, options) => apiFetch(`${base}/lookup?${new URLSearchParams({ email: email.trim() })}`, options);
export function saveStaffGroup(group) {
  const { id, name, code, description, permissions, version } = group;
  return apiFetch(id ? `${base}/groups/${encodeURIComponent(id)}` : `${base}/groups`, {
    method: id ? "PUT" : "POST", body: JSON.stringify({ name, code, description, permissions, version }),
  });
}
export const deleteStaffGroup = ({ id, version }) => apiFetch(`${base}/groups/${encodeURIComponent(id)}?${new URLSearchParams({ version })}`, { method: "DELETE" });
export function saveStaffMember(member, create) {
  const { uid, displayName, phoneNumber, email, groupId, active, notes, version } = member;
  return apiFetch(create ? `${base}/members` : `${base}/members/${encodeURIComponent(uid)}`, {
    method: create ? "POST" : "PUT", body: JSON.stringify({ ...(create ? { displayName, phoneNumber, email } : { version }), groupId, active, notes }),
  });
}
export const deleteStaffMember = ({ uid, version }) => apiFetch(`${base}/members/${encodeURIComponent(uid)}?${new URLSearchParams({ version })}`, { method: "DELETE" });

export const resendStaffCredentials = (uid) => apiFetch(`${base}/members/${encodeURIComponent(uid)}/credentials/resend`, { method: "POST" });

export function staffErrorKey(error) {
  const code = error?.body?.code;
  if (["STAFF_INVALID", "STAFF_NOT_FOUND", "STAFF_CONFLICT", "STAFF_GROUP_NOT_EMPTY", "STAFF_SELF_PROTECTED", "STAFF_EMAIL_EXISTS", "STAFF_RATE_LIMITED", "STAFF_CREDENTIAL_BUSY", "STAFF_AUTH_UNAVAILABLE"].includes(code)) return `staffError_${code}`;
  if (error?.status === 401) return "staffErrorAuth";
  if (error?.status === 403) return "staffErrorAccess";
  return "staffErrorRequest";
}
