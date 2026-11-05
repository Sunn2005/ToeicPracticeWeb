export const ACTIVE_AI_ANALYSIS_STATUSES = new Set(["PENDING", "PROCESSING"]);

const AI_ANALYSIS_ERROR_KEYS = {
  INVALID_GEMINI_OUTPUT: "aiAnalysisInvalidOutput",
  GEMINI_UNAVAILABLE: "aiAnalysisUnavailable",
  GEMINI_REQUEST_FAILED: "aiAnalysisRequestFailed",
  INVALID_INPUT: "aiAnalysisInvalidInput",
  PROCESSING_INTERRUPTED: "aiAnalysisInterrupted",
  AI_REVIEW_FAILED: "aiAnalysisServiceFailed",
};

export function shouldPollAIAnalysis(status) {
  return ACTIVE_AI_ANALYSIS_STATUSES.has(status);
}

export function canRequestAIAnalysis(result) {
  return result?.type === "FULL_TEST" && result?.mode === "FULL";
}

export function selectAIAnalysisResult(storedResult, language) {
  return storedResult?.[language] || storedResult;
}

export function getAIAnalysisErrorKey(errorCode) {
  return AI_ANALYSIS_ERROR_KEYS[errorCode] || "aiAnalysisServiceFailed";
}
