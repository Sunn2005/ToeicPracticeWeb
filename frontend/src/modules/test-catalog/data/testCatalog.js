export const TOEIC_TESTS = [
  {
    id: "test-1",
    name: "Test 1",
    title: "TOEIC Listening & Reading – Test 1",
    totalQuestions: 200,
    duration: 120,
    available: true,
  },
  {
    id: "test-2",
    name: "Test 2",
    title: "TOEIC Listening & Reading – Test 2",
    totalQuestions: 200,
    duration: 120,
    available: true,
  },
  {
    id: "test-3",
    name: "Test 3",
    title: "TOEIC Listening & Reading – Test 3",
    totalQuestions: 200,
    duration: 120,
    available: true,
  },
];

export const ETS_2026_TEST_4 = {
  id: "test-4",
  name: "Test 4",
  title: "ETS 2026 Listening & Reading – Test 4",
  totalQuestions: 200,
  duration: 120,
  available: true,
};

function findTest(testId) {
  return testId === ETS_2026_TEST_4.id
    ? ETS_2026_TEST_4
    : TOEIC_TESTS.find((test) => test.id === testId);
}

export function getTestName(testId) {
  return findTest(testId)?.name || testId || "TOEIC Test";
}

export function getTestTitle(testId) {
  return findTest(testId)?.title || getTestName(testId);
}

export const TOEIC_PARTS = [
  { part: 1, section: "LISTENING", questions: 6, label: "Mô tả tranh" },
  { part: 2, section: "LISTENING", questions: 25, label: "Hỏi–đáp" },
  { part: 3, section: "LISTENING", questions: 39, label: "Hội thoại" },
  { part: 4, section: "LISTENING", questions: 30, label: "Bài nói" },
  { part: 5, section: "READING", questions: 30, label: "Hoàn thành câu" },
  { part: 6, section: "READING", questions: 16, label: "Hoàn thành đoạn văn" },
  { part: 7, section: "READING", questions: 54, label: "Đọc hiểu" },
];

export const EXAM_MODES = [
  {
    id: "FULL",
    icon: "FT",
    name: "Full Test",
    description: "Take a complete TOEIC-style test",
    duration: 120,
    questions: 200,
    parts: "Part 1 → Part 7",
    tone: "sky",
  },
  {
    id: "LISTENING",
    icon: "L",
    name: "Listening Test",
    description: "Take the Listening section only",
    duration: 45,
    questions: 100,
    parts: "Part 1 → Part 4",
    tone: "cyan",
  },
  {
    id: "READING",
    icon: "R",
    name: "Reading Test",
    description: "Take the Reading section only",
    duration: 75,
    questions: 100,
    parts: "Part 5 → Part 7",
    tone: "violet",
  },
];
