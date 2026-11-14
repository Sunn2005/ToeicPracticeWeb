const examTests = new Map();

function cacheKey(testId, partNumbers) {
  const parts = (Array.isArray(partNumbers) && partNumbers.length
    ? partNumbers
    : [1, 2, 3, 4, 5, 6, 7])
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  return `${testId}:${parts.join(",")}`;
}

export function rememberExamTest(test) {
  if (!test?.testId || !Array.isArray(test.parts) || test.parts.length === 0) return;
  examTests.set(
    cacheKey(test.testId, test.parts.map((part) => part.partNumber)),
    test,
  );
}

export function recallExamTest(testId, partNumbers) {
  if (!testId) return null;
  return examTests.get(cacheKey(testId, partNumbers)) || null;
}
