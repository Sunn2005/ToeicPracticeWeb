import test from "node:test";
import assert from "node:assert/strict";

import { buildReadingUnits } from "./testData.js";

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
