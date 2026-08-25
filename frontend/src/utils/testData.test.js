import test from "node:test";
import assert from "node:assert/strict";

import {
  buildListeningUnits,
  buildReadingUnits,
  formatClock,
  formatQuestionProgress,
} from "./testData.js";

test("formats the countdown as hours, minutes, and seconds", () => {
  assert.equal(formatClock(6_004), "01:40:04");
  assert.equal(formatClock(9), "00:00:09");
});

test("formats question progress for a single question and a Listening group", () => {
  assert.equal(
    formatQuestionProgress(
      Array.from({ length: 200 }, (_, index) => index + 1),
      [101],
      200,
    ),
    "101/200",
  );
  assert.equal(
    formatQuestionProgress(
      Array.from({ length: 39 }, (_, index) => index + 32),
      [32, 33, 34],
      39,
    ),
    "1–3/39",
  );
});

test("keeps Supabase graphic URL on grouped Listening units", () => {
  const imageUrl = "https://example.supabase.co/T01-P3-62-64.png";
  const transcriptTranslation = "Bản dịch transcript";
  const testData = {
    parts: [
      {
        partNumber: 3,
        name: "Conversations",
        groups: [
          {
            questionRange: "62-64",
            imageUrl,
            transcriptTranslation,
            questions: [
              { questionNumber: 62 },
              { questionNumber: 64 },
            ],
          },
        ],
      },
    ],
  };

  const [unit] = buildListeningUnits(testData);

  assert.equal(unit.imageUrl, imageUrl);
  assert.equal(unit.transcriptTranslation, transcriptTranslation);
  assert.equal(unit.start, 62);
  assert.equal(unit.end, 64);
});

test("keeps group image URLs on Part 7 reading units", () => {
  const imageUrls = ["https://example.com/passage-1.png", "https://example.com/passage-2.png"];
  const testData = {
    parts: [
      {
        partNumber: 7,
        name: "Reading Comprehension",
        passageGroups: [
          {
            groupNumber: 1,
            imageUrls,
            passages: [],
            questions: [
              { questionNumber: 176 },
              { questionNumber: 180 },
            ],
          },
        ],
      },
    ],
  };

  const [unit] = buildReadingUnits(testData);

  assert.deepEqual(unit.imageUrls, imageUrls);
  assert.equal(unit.start, 176);
  assert.equal(unit.end, 180);
});
