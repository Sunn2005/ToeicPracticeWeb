import test from "node:test";
import assert from "node:assert/strict";
import {
  canRequestAIAnalysis,
  selectAIAnalysisResult,
  shouldPollAIAnalysis,
} from "./aiAnalysis.js";

test("polls only while an AI analysis is active", () => {
  assert.equal(shouldPollAIAnalysis("PENDING"), true);
  assert.equal(shouldPollAIAnalysis("PROCESSING"), true);
  assert.equal(shouldPollAIAnalysis("COMPLETED"), false);
  assert.equal(shouldPollAIAnalysis("FAILED"), false);
});

test("offers analysis only for completed-result Full Test mode", () => {
  assert.equal(canRequestAIAnalysis({ type: "FULL_TEST", mode: "FULL" }), true);
  assert.equal(canRequestAIAnalysis({ type: "PRACTICE", mode: "PART" }), false);
  assert.equal(canRequestAIAnalysis({ type: "FULL_TEST", mode: "READING" }), false);
});

test("selects the AI review matching the active language and supports legacy results", () => {
  const bilingual = {
    vi: { summary: { headline: "Tiếng Việt" } },
    en: { summary: { headline: "English" } },
  };
  assert.equal(selectAIAnalysisResult(bilingual, "vi").summary.headline, "Tiếng Việt");
  assert.equal(selectAIAnalysisResult(bilingual, "en").summary.headline, "English");

  const legacy = { summary: { headline: "Legacy" } };
  assert.equal(selectAIAnalysisResult(legacy, "vi"), legacy);
});
