import test from "node:test";
import assert from "node:assert/strict";

import {
  formatListeningTranscript,
  getReviewParagraphs,
} from "./reviewContent.js";

test("separates the selected answer, choices, and useful structures", () => {
  const paragraphs = getReviewParagraphs(
    "Chọn (B) spread. (A) break: giờ nghỉ. (B) spread: sự lan truyền. Useful Structures: the spread of + N.",
  );

  assert.deepEqual(paragraphs, [
    "Chọn (B) spread.",
    "(A) break: giờ nghỉ.\n(B) spread: sự lan truyền.",
    "Useful Structures: the spread of + N.",
  ]);
});

test("keeps translated answer choices on separate lines", () => {
  const paragraphs = getReviewParagraphs(
    "Mục đích là gì?\n(A) Thông báo.\n(B) Yêu cầu.",
  );

  assert.deepEqual(paragraphs, [
    "Mục đích là gì?\n(A) Thông báo.\n(B) Yêu cầu.",
  ]);
});

test("returns no paragraphs for empty content", () => {
  assert.deepEqual(getReviewParagraphs("   "), []);
});

test("puts every Part 3 speaker turn in a separate paragraph", () => {
  assert.equal(
    formatListeningTranscript(
      "W: Hello. M: Hi there. W: How are you? M1: We're doing well.",
      3,
    ),
    "W: Hello.\n\nM: Hi there.\n\nW: How are you?\n\nM1: We're doing well.",
  );
});

test("puts every Part 4 sentence in a separate paragraph", () => {
  assert.equal(
    formatListeningTranscript(
      "Attention, passengers. All trains are delayed. Please wait here.",
      4,
    ),
    "Attention, passengers.\n\nAll trains are delayed.\n\nPlease wait here.",
  );
});
