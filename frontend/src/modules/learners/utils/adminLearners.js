export function learnerErrorKey(error) {
  if (error?.status === 401) return "adminLearnersAuthError";
  if (error?.status === 403) return "adminLearnersAccessError";
  if (error?.status === 404) return "adminLearnerNotFoundError";
  if (error?.status === 503) return "adminLearnersUnavailable";
  return "adminLearnersRequestError";
}

export function formatLearnerDate(value, language) {
  if (value == null) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function learnerInitials(learner) {
  const source = learner?.displayName || learner?.email || "?";
  return source.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
