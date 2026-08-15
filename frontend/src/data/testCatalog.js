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
    available: false,
  },
  {
    id: "test-3",
    name: "Test 3",
    title: "TOEIC Listening & Reading – Test 3",
    totalQuestions: 200,
    duration: 120,
    available: false,
  },
];

export const TOEIC_PARTS = [
  { part: 1, section: "LISTENING", questions: 6 },
  { part: 2, section: "LISTENING", questions: 25 },
  { part: 3, section: "LISTENING", questions: 39 },
  { part: 4, section: "LISTENING", questions: 30 },
  { part: 5, section: "READING", questions: 30 },
  { part: 6, section: "READING", questions: 16 },
  { part: 7, section: "READING", questions: 54 },
];

export const EXAM_MODES = [
  {
    id: "FULL",
    icon: "FT",
    name: "Full Test",
    description: "Làm như thi thật",
    duration: 120,
    questions: 200,
    parts: "Part 1 → Part 7",
    tone: "sky",
  },
  {
    id: "LISTENING",
    icon: "L",
    name: "Thi Listening",
    description: "Thi riêng phần nghe",
    duration: 45,
    questions: 100,
    parts: "Part 1 → Part 4",
    tone: "cyan",
  },
  {
    id: "READING",
    icon: "R",
    name: "Thi Reading",
    description: "Thi riêng phần đọc",
    duration: 75,
    questions: 100,
    parts: "Part 5 → Part 7",
    tone: "violet",
  },
];
