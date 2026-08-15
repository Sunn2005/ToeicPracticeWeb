import test from "node:test";
import assert from "node:assert/strict";

import { getReviewParagraphs } from "./reviewContent.js";

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
