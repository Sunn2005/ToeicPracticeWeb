/**
 * CSV import for employee tests.
 *
 * The CSV follows the team's template: one row per question, media columns
 * hold bare file names only (e.g. "T05-01.mp3", "T05-P1-1.png"). Files are
 * uploaded to the public Supabase bucket `toeic-media` beforehand; at import
 * time each name is expanded into the full public URL the player consumes:
 *
 *   <MEDIA_BASE_URL>/<Txx-media>/audio/<name>    for the "File audio" column
 *   <MEDIA_BASE_URL>/<Txx-media>/picture/<name>  for the "File ảnh" column
 *
 * The media folder is derived from the file-name prefix (T05-… → T05-media),
 * which matches the bucket layout used by the packaged seed tests.
 *
 * buildTestFromCsv returns { test, issues, stats, suggestedTitle }. When
 * issues is non-empty, test is null and every issue carries the CSV row it
 * came from so the dialog can report errors per row and block the import.
 */

export const MEDIA_BASE_URL =
  "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/toeic-media/";

export const CSV_TEMPLATE_HEADERS = [
  "Part", "Số câu", "Mã nhóm", "Mã đoạn", "Câu hỏi", "A", "B", "C", "D",
  "Đáp án đúng", "Giải thích", "Dịch câu hỏi", "Dịch đáp án", "Transcript",
  "Dịch transcript", "Nội dung đoạn", "Tiêu đề đoạn", "File ảnh", "File audio",
];

const PART_META = {
  1: { min: 1, max: 6, count: 6, name: "Phần 1: Hình ảnh" },
  2: { min: 7, max: 31, count: 25, name: "Phần 2: Hỏi - Đáp" },
  3: { min: 32, max: 70, count: 39, name: "Phần 3: Hội thoại" },
  4: { min: 71, max: 100, count: 30, name: "Phần 4: Bài nói ngắn" },
  5: { min: 101, max: 130, count: 30, name: "Phần 5: Điền câu" },
  6: { min: 131, max: 146, count: 16, name: "Phần 6: Điền đoạn văn" },
  7: { min: 147, max: 200, count: 54, name: "Phần 7: Đọc hiểu" },
};

const AUDIO_NAME_RE = /^[A-Za-z]\d+-[\w\-.]+\.mp3$/i;
const IMAGE_NAME_RE = /^[A-Za-z]\d+-[\w\-.]+\.(png|jpe?g)$/i;

/** Expand a bare media file name from the CSV into its full public URL. */
export function mediaFileUrl(fileName, kind) {
  const name = String(fileName || "").trim();
  const prefix = name.match(/^([A-Za-z]\d+)-/);
  const folder = prefix ? `${prefix[1].toUpperCase()}-media` : "";
  const subfolder = kind === "audio" ? "audio" : "picture";
  return `${MEDIA_BASE_URL}${folder}/${subfolder}/${name}`;
}

/**
 * Minimal RFC 4180-style CSV parser: handles quoted fields, doubled quotes,
 * commas and newlines inside quotes, LF or CRLF line endings, and a BOM.
 * Returns an array of rows, each an array of raw string cells.
 */
export function parseCsv(text) {
  const input = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const endField = () => { row.push(field); field = ""; };
  const endRow = () => { endField(); rows.push(row); row = []; };
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) endRow();
  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
}

/** A downloadable template: just the header row of the import format. */
export function buildTemplateCsv() {
  return `\uFEFF${CSV_TEMPLATE_HEADERS.join(",")}\r\n`;
}

function suggestTitleFromText(text) {
  const match = String(text || "").match(/T0*(\d+)-[\w\-.]+\.(?:mp3|png|jpe?g)/i);
  return match ? `TOEIC Listening & Reading - Test ${Number(match[1])}` : "";
}

const splitNames = (cell) =>
  String(cell || "").split(";").map((name) => name.trim()).filter(Boolean);

export function buildTestFromCsv(text, { title = "" } = {}) {
  const issues = [];
  const add = (code, values = {}, row = 0) => issues.push({ row, code, values });
  const suggestedTitle = suggestTitleFromText(text);
  const stats = {
    rowCount: 0,
    partCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    audioCount: 0,
    imageCount: 0,
    ignoredAnswerTranslation: false,
  };
  const done = (test) => ({ test, issues, stats, suggestedTitle });

  const rawRows = parseCsv(text);
  if (!rawRows.length) {
    add("employeeImportIssueEmptyFile");
    return done(null);
  }
  const header = rawRows[0].map((cell) => String(cell).trim());
  const missingHeaders = CSV_TEMPLATE_HEADERS.filter((name) => !header.includes(name));
  if (missingHeaders.length) {
    missingHeaders.forEach((name) => add("employeeImportIssueHeader", { column: name }));
    return done(null);
  }
  const col = Object.fromEntries(CSV_TEMPLATE_HEADERS.map((name) => [name, header.indexOf(name)]));
  const cell = (cells, name) => String(cells[col[name]] ?? "").trim();

  const records = rawRows.slice(1).map((cells, index) => ({
    row: index + 2,
    part: Number.parseInt(cell(cells, "Part"), 10),
    questionNumber: Number.parseInt(cell(cells, "Số câu"), 10),
    groupCode: cell(cells, "Mã nhóm"),
    passageCode: cell(cells, "Mã đoạn"),
    question: cell(cells, "Câu hỏi"),
    answers: ["A", "B", "C", "D"].map((label) => ({ label, content: cell(cells, label) })),
    correctAnswer: cell(cells, "Đáp án đúng").toUpperCase(),
    explanation: cell(cells, "Giải thích"),
    questionTranslation: cell(cells, "Dịch câu hỏi"),
    answerTranslation: cell(cells, "Dịch đáp án"),
    transcript: cell(cells, "Transcript"),
    transcriptTranslation: cell(cells, "Dịch transcript"),
    passageContent: cell(cells, "Nội dung đoạn"),
    passageTitle: cell(cells, "Tiêu đề đoạn"),
    imageNames: splitNames(cell(cells, "File ảnh")),
    audioNames: splitNames(cell(cells, "File audio")),
  }));
  stats.rowCount = records.length;
  stats.ignoredAnswerTranslation = records.some((rec) => rec.answerTranslation !== "");

  // --- File-level structure -------------------------------------------------
  if (records.length !== 200) {
    add("employeeImportIssueRowCount", { expected: 200, actual: records.length });
  }
  const seenNumbers = new Set();
  for (const rec of records) {
    if (!PART_META[rec.part]) {
      add("employeeImportIssuePartInvalid", { value: Number.isNaN(rec.part) ? "" : rec.part }, rec.row);
      continue;
    }
    stats.partCounts[rec.part] += 1;
    if (!Number.isInteger(rec.questionNumber) || rec.questionNumber < 1 || rec.questionNumber > 200) {
      add("employeeImportIssueQuestionNumber", {}, rec.row);
      continue;
    }
    if (seenNumbers.has(rec.questionNumber)) {
      add("employeeImportIssueQuestionDuplicate", { question: rec.questionNumber }, rec.row);
    }
    seenNumbers.add(rec.questionNumber);
    const meta = PART_META[rec.part];
    if (rec.questionNumber < meta.min || rec.questionNumber > meta.max) {
      add("employeeImportIssueQuestionPartRange", { question: rec.questionNumber, part: rec.part }, rec.row);
    }
  }
  for (const [part, meta] of Object.entries(PART_META)) {
    if (stats.partCounts[part] !== meta.count) {
      add("employeeImportIssuePartCount", { part, expected: meta.count, actual: stats.partCounts[part] });
    }
  }

  // --- Per-question checks --------------------------------------------------
  const checkMediaNames = (rec) => {
    for (const name of rec.audioNames) {
      if (!AUDIO_NAME_RE.test(name)) add("employeeImportIssueMediaNameInvalid", { value: name }, rec.row);
    }
    for (const name of rec.imageNames) {
      if (!IMAGE_NAME_RE.test(name)) add("employeeImportIssueMediaNameInvalid", { value: name }, rec.row);
    }
    if (rec.audioNames.length > 1) add("employeeImportIssueMediaNameInvalid", { value: rec.audioNames.join("; ") }, rec.row);
  };
  const buildQuestion = (rec) => {
    const filled = rec.answers.filter((answer) => answer.content !== "");
    const isPrefix = filled.every((answer, i) => answer.label === rec.answers[i].label);
    if (filled.length < 3 || !isPrefix) {
      add("employeeImportIssueAnswersInvalid", { question: rec.questionNumber }, rec.row);
    }
    if (rec.part === 2 && rec.answers[3].content !== "") {
      add("employeeImportIssuePart2AnswerD", { question: rec.questionNumber }, rec.row);
    }
    if (!filled.some((answer) => answer.label === rec.correctAnswer)) {
      add("employeeImportIssueCorrectInvalid", { question: rec.questionNumber, value: rec.correctAnswer }, rec.row);
    }
    if (!rec.question) {
      add("employeeImportIssueQuestionMissing", { question: rec.questionNumber }, rec.row);
    }
    const question = {
      questionNumber: rec.questionNumber,
      question: rec.question,
      answers: filled,
      correctAnswer: rec.correctAnswer,
    };
    if (rec.questionTranslation) question.questionTranslation = rec.questionTranslation;
    if (rec.explanation) question.explanation = rec.explanation;
    return question;
  };

  const byPart = (part) => records
    .filter((rec) => rec.part === part)
    .sort((a, b) => a.questionNumber - b.questionNumber);
  const groupBy = (partRecords, keyOf) => {
    const groups = new Map();
    for (const rec of partRecords) {
      const key = keyOf(rec);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(rec);
    }
    return [...groups.values()];
  };
  // Group-level media must agree on every row of the group; returns the
  // agreed names plus whether the rows were consistent.
  const agreedNames = (groupRecords, field, code) => {
    const distinct = [...new Set(groupRecords.map((rec) => rec[field].join("; ")))];
    const nonEmpty = distinct.filter((value) => value !== "");
    if (nonEmpty.length > 1) {
      add(code, { group: groupRecords[0].groupCode || groupRecords[0].passageCode }, groupRecords[0].row);
    }
    return splitNames(nonEmpty[0] || "");
  };
  const joinedTranscript = (groupRecords, field) => {
    const chunks = [];
    for (const rec of groupRecords) {
      if (rec[field] && !chunks.includes(rec[field])) chunks.push(rec[field]);
    }
    return chunks.join("\n");
  };
  const agreedPassageContent = (groupRecords) => {
    const distinct = [...new Set(groupRecords.map((rec) => rec.passageContent).filter(Boolean))];
    if (!distinct.length) {
      add("employeeImportIssuePassageMissing", { group: groupRecords[0].passageCode }, groupRecords[0].row);
      return "";
    }
    if (distinct.length > 1) {
      add("employeeImportIssuePassageInconsistent", { group: groupRecords[0].passageCode }, groupRecords[0].row);
    }
    return distinct[0];
  };

  const parts = [];

  // --- Parts 1, 2, 5: flat question lists -----------------------------------
  for (const partNumber of [1, 2, 5]) {
    const questions = byPart(partNumber).map((rec) => {
      checkMediaNames(rec);
      const question = buildQuestion(rec);
      if (partNumber === 1) {
        if (!rec.audioNames.length || !rec.imageNames.length) {
          add("employeeImportIssueP1MediaMissing", { question: rec.questionNumber }, rec.row);
        }
        if (rec.imageNames.length > 1) add("employeeImportIssueImageMultiple", { question: rec.questionNumber }, rec.row);
        if (rec.audioNames[0]) question.audioUrl = mediaFileUrl(rec.audioNames[0], "audio");
        if (rec.imageNames[0]) question.imageUrl = mediaFileUrl(rec.imageNames[0], "image");
        if (rec.transcript) question.transcript = rec.transcript;
        if (rec.transcriptTranslation) question.transcriptTranslation = rec.transcriptTranslation;
      }
      if (partNumber === 2) {
        if (!rec.audioNames.length) add("employeeImportIssueP2AudioMissing", { question: rec.questionNumber }, rec.row);
        if (rec.imageNames.length) add("employeeImportIssueMediaNotAllowed", { question: rec.questionNumber }, rec.row);
        if (rec.audioNames[0]) question.audioUrl = mediaFileUrl(rec.audioNames[0], "audio");
        if (rec.transcript) question.transcript = rec.transcript;
        if (rec.transcriptTranslation) question.transcriptTranslation = rec.transcriptTranslation;
      }
      if (partNumber === 5 && (rec.audioNames.length || rec.imageNames.length)) {
        add("employeeImportIssueMediaNotAllowed", { question: rec.questionNumber }, rec.row);
      }
      return question;
    });
    parts.push({ partNumber, name: PART_META[partNumber].name, questions });
  }

  // --- Parts 3, 4: conversation / talk groups of exactly 3 questions --------
  for (const partNumber of [3, 4]) {
    const groups = groupBy(byPart(partNumber), (rec) => rec.groupCode || `auto-${rec.questionNumber}`)
      .map((groupRecords) => {
        const first = groupRecords[0];
        if (!first.groupCode) add("employeeImportIssueGroupCodeMissing", {}, first.row);
        if (groupRecords.length !== 3) {
          add("employeeImportIssueGroupSize", { group: first.groupCode, expected: 3, actual: groupRecords.length }, first.row);
        }
        groupRecords.forEach(checkMediaNames);
        const audioNames = agreedNames(groupRecords, "audioNames", "employeeImportIssueGroupAudioInconsistent");
        if (!audioNames.length) {
          add("employeeImportIssueGroupAudioMissing", { group: first.groupCode }, first.row);
        }
        const imageNames = agreedNames(groupRecords, "imageNames", "employeeImportIssueGroupImageInconsistent");
        if (imageNames.length > 1) add("employeeImportIssueImageMultiple", { question: first.questionNumber }, first.row);
        const group = {
          questionRange: `${groupRecords[0].questionNumber}-${groupRecords[groupRecords.length - 1].questionNumber}`,
          questions: groupRecords.map(buildQuestion),
        };
        if (audioNames[0]) group.audioUrl = mediaFileUrl(audioNames[0], "audio");
        if (imageNames[0]) group.imageUrl = mediaFileUrl(imageNames[0], "image");
        const transcript = joinedTranscript(groupRecords, "transcript");
        if (transcript) group.transcript = transcript;
        const transcriptTranslation = joinedTranscript(groupRecords, "transcriptTranslation");
        if (transcriptTranslation) group.transcriptTranslation = transcriptTranslation;
        return group;
      });
    parts.push({ partNumber, name: PART_META[partNumber].name, groups });
  }

  // --- Part 6: passages of exactly 4 questions ------------------------------
  const part6Passages = groupBy(byPart(6), (rec) => rec.passageCode || `auto-${rec.questionNumber}`)
    .map((groupRecords, index) => {
      const first = groupRecords[0];
      if (!first.passageCode) add("employeeImportIssueGroupCodeMissing", {}, first.row);
      if (groupRecords.length !== 4) {
        add("employeeImportIssuePassageSize", { group: first.passageCode, expected: 4, actual: groupRecords.length }, first.row);
      }
      groupRecords.forEach(checkMediaNames);
      groupRecords.forEach((rec) => {
        if (rec.audioNames.length) add("employeeImportIssueMediaNotAllowed", { question: rec.questionNumber }, rec.row);
      });
      const imageNames = agreedNames(groupRecords, "imageNames", "employeeImportIssueGroupImageInconsistent");
      if (imageNames.length > 1) add("employeeImportIssueImageMultiple", { question: first.questionNumber }, first.row);
      const passage = {
        passageNumber: index + 1,
        content: agreedPassageContent(groupRecords),
        questions: groupRecords.map(buildQuestion),
      };
      if (first.passageTitle) passage.title = first.passageTitle;
      if (imageNames[0]) passage.imageUrl = mediaFileUrl(imageNames[0], "image");
      return passage;
    });
  parts.push({ partNumber: 6, name: PART_META[6].name, passages: part6Passages });

  // --- Part 7: passage groups, one passage + shared images per group --------
  const part7Groups = groupBy(byPart(7), (rec) => rec.passageCode || `auto-${rec.questionNumber}`)
    .map((groupRecords, index) => {
      const first = groupRecords[0];
      if (!first.passageCode) add("employeeImportIssueGroupCodeMissing", {}, first.row);
      groupRecords.forEach(checkMediaNames);
      groupRecords.forEach((rec) => {
        if (rec.audioNames.length) add("employeeImportIssueMediaNotAllowed", { question: rec.questionNumber }, rec.row);
      });
      const imageUrls = [];
      for (const rec of groupRecords) {
        for (const name of rec.imageNames) {
          const url = mediaFileUrl(name, "image");
          if (!imageUrls.includes(url)) imageUrls.push(url);
        }
      }
      return {
        groupNumber: index + 1,
        imageUrls,
        passages: [{ title: first.passageTitle, content: agreedPassageContent(groupRecords) }],
        questions: groupRecords.map(buildQuestion),
      };
    });
  parts.push({ partNumber: 7, name: PART_META[7].name, passageGroups: part7Groups });

  // --- Media totals -----------------------------------------------------------
  const audioSet = new Set();
  const imageSet = new Set();
  for (const rec of records) {
    rec.audioNames.forEach((name) => audioSet.add(name));
    rec.imageNames.forEach((name) => imageSet.add(name));
  }
  stats.audioCount = audioSet.size;
  stats.imageCount = imageSet.size;

  if (issues.length) return done(null);
  parts.sort((a, b) => a.partNumber - b.partNumber);
  return done({
    title: title || suggestedTitle,
    description: "",
    type: "FULL_TEST",
    difficulty: "intermediate",
    totalQuestions: 200,
    listeningMinutes: 45,
    readingMinutes: 75,
    totalMinutes: 120,
    parts,
  });
}
