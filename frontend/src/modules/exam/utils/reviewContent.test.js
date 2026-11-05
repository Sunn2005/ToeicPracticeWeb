import test from "node:test";
import assert from "node:assert/strict";

import {
  formatListeningTranscript,
  formatPartTwoTranscript,
  formatTranslatedTranscript,
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

test("formats Part 2 transcript choices as readable labelled lines", () => {
  assert.equal(
    formatPartTwoTranscript(
      "Where is the conference being held? (A) A three-day vacation. (B) At the Riverview Hotel. (C) In the supply cabinet.",
    ),
    "Where is the conference being held?\nA. A three-day vacation.\nB. At the Riverview Hotel.\nC. In the supply cabinet.",
  );
});

test("combines a translated listening prompt and labelled answers", () => {
  assert.equal(
    formatTranslatedTranscript(
      "Hội nghị được tổ chức ở đâu?",
      "(A) Một kỳ nghỉ ba ngày.\n(B) Tại khách sạn Riverview.\n(C) Trong tủ đựng vật tư.",
    ),
    "Hội nghị được tổ chức ở đâu?\nA. Một kỳ nghỉ ba ngày.\nB. Tại khách sạn Riverview.\nC. Trong tủ đựng vật tư.",
  );
});

test("Part 1 translated transcript can contain answer lines only", () => {
  assert.equal(
    formatTranslatedTranscript(null, "(A) Người phụ nữ đang bê một khay thức ăn."),
    "A. Người phụ nữ đang bê một khay thức ăn.",
  );
});
