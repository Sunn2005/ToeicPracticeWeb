import { apiFetch, publicApiFetch } from "./client";

export const requestStaffPasswordReset = (email) => publicApiFetch("/api/v1/auth/staff/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
export const resetStaffPassword = (email, token, newPassword) => publicApiFetch("/api/v1/auth/staff/reset-password", { method: "POST", body: JSON.stringify({ email, token, newPassword }) });
export const changeStaffPassword = (oldPassword, newPassword) => apiFetch("/api/console/account/password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) });
export function passwordErrorKey(error) {
  const code = error?.body?.code;
  if (["STAFF_PASSWORD_INCORRECT", "STAFF_PASSWORD_INVALID", "STAFF_RESET_INVALID", "STAFF_TEMP_EXPIRED", "STAFF_RATE_LIMITED", "STAFF_CREDENTIAL_BUSY", "STAFF_AUTH_UNAVAILABLE"].includes(code)) return `staffError_${code}`;
  return error?.status === 401 ? "staffErrorAuth" : "staffErrorRequest";
}
