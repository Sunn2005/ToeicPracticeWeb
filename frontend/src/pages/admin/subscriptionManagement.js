export function defaultExpiry(now = new Date()) {
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + 30);
  const pad = (value) => String(value).padStart(2, "0");
  return `${expiry.getFullYear()}-${pad(expiry.getMonth() + 1)}-${pad(expiry.getDate())}T${pad(expiry.getHours())}:${pad(expiry.getMinutes())}:${pad(expiry.getSeconds())}`;
}

export function expiryEpoch(value, now = Date.now()) {
  const epoch = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(epoch) && epoch > now ? epoch : null;
}

export function subscriptionStatusKey(summary) {
  if (!summary?.status) return "adminSubscriptionNone";
  if (summary.status === "REVOKED") return "adminSubscriptionRevoked";
  return summary.effective ? "adminSubscriptionActive" : "adminSubscriptionExpired";
}

export function subscriptionErrorKey(error) {
  if (error?.status === 401) return "adminSubscriptionAuthError";
  if (error?.status === 403) return "adminSubscriptionAccessError";
  if (error?.body?.code === "SUBSCRIPTION_EXPIRY_INVALID") return "adminSubscriptionExpiryError";
  if (error?.status === 404) return "adminSubscriptionNotFoundError";
  return "adminSubscriptionRequestError";
}
