export const ACTIVE_AI_ANALYSIS_STATUSES = new Set(["PENDING", "PROCESSING"]);

export function shouldPollAIAnalysis(status) {
  return ACTIVE_AI_ANALYSIS_STATUSES.has(status);
}

export function canRequestAIAnalysis(result) {
  return result?.type === "FULL_TEST" && result?.mode === "FULL";
}
