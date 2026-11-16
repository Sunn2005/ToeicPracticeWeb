import test from "node:test";
import assert from "node:assert/strict";
import {
  CSV_TEMPLATE_HEADERS, buildTemplateCsv, buildTestFromCsv, buildTestFromRows, mediaFileUrl, parseCsv,
} from "./csvImport.js";
import {
  employeeTestPayload, validateEmployeeTest,
} from "../components/test-editor/testEditorState.js";

const esc = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (rows) => [CSV_TEMPLATE_HEADERS, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");

function makeRow(part, q, over = {}) {
  const rec = {
    "Part": part, "Số câu": q, "Mã nhóm": "", "Mã đoạn": "",
    "Câu hỏi": `Question ${q}: choose the best answer, carefully`,
    "A": `Option A of ${q}`, "B": `Option B of ${q}`, "C": `Option C of ${q}`,
    "D": part === 2 ? "" : `Option D of ${q}`,
    "Đáp án đúng": "B", "Giải thích": `Explanation for ${q}`, "Dịch câu hỏi": `Dịch câu ${q}`,
    "Dịch đáp án": "", "Transcript": "", "Dịch transcript": "",
    "Nội dung đoạn": "", "Tiêu đề đoạn": "", "File ảnh": "", "File audio": "",
    ...over,
  };
  return CSV_TEMPLATE_HEADERS.map((h) => rec[h]);
}

// A full, valid 200-row file mirroring the real Test 5 media layout.
function validRows() {
  const rows = [];
  for (let q = 1; q <= 6; q += 1) {
    rows.push(makeRow(1, q, { "File audio": `T05-${String(q).padStart(2, "0")}.mp3`, "File ảnh": `T05-P1-${q}.png` }));
  }
  for (let q = 7; q <= 31; q += 1) {
    rows.push(makeRow(2, q, { "File audio": `T05-${String(q).padStart(2, "0")}.mp3` }));
  }
  for (const [part, start, end] of [[3, 32, 70], [4, 71, 100]]) {
    for (let s = start; s <= end; s += 3) {
      const code = `T05-${s}-${s + 2}`;
      const image = (part === 3 && s >= 62) || (part === 4 && s >= 95) ? `T05-P${part}-${s}-${s + 2}.png` : "";
      for (let q = s; q <= s + 2; q += 1) {
        rows.push(makeRow(part, q, {
          "Mã nhóm": code, "File audio": `${code}.mp3`, "File ảnh": image,
          "Transcript": `Transcript of ${code}`,
        }));
      }
    }
  }
  for (let q = 101; q <= 130; q += 1) rows.push(makeRow(5, q));
  for (let s = 131; s <= 146; s += 4) {
    const code = `T05-${s}-${s + 3}`;
    for (let q = s; q <= s + 3; q += 1) {
      rows.push(makeRow(6, q, {
        "Mã đoạn": code, "Nội dung đoạn": `Passage text\nfor ${code}`, "Tiêu đề đoạn": `Title ${code}`,
        "File ảnh": `T05-P6-${s}-${s + 3}.png`,
      }));
    }
  }
  const p7Groups = [
    ["147-148", ["T05-P7-147-148.png"]], ["149-150", ["T05-P7-149-150.png"]],
    ["151-152", ["T05-P7-151-152.png"]], ["153-154", ["T05-P7-153-154.png"]],
    ["155-157", ["T05-P7-155-157.png"]], ["158-160", ["T05-P7-158-160.png"]],
    ["161-164", []], ["165-167", ["T05-P7-164-167.png"]],
    ["168-171", ["T05-P7-168-171.png"]], ["172-175", ["T05-P7-172-175.png"]],
    ["176-180", ["T05-P7-176-180-1.png", "T05-P7-176-180-2.png"]],
    ["181-185", ["T05-P7-181-185-1.png", "T05-P7-181-185-2.png"]],
    ["186-190", ["T05-P7-186-190-1.png", "T05-P7-186-190-2.png", "T05-P7-186-190-3.png"]],
    ["191-195", ["T05-P7-191-195-1.png", "T05-P7-191-195-2.png", "T05-P7-191-195-3.png"]],
    ["196-200", ["T05-P7-196-200-1.png", "T05-P7-196-200-2.png", "T05-P7-196-200-3.png"]],
  ];
  for (const [range, images] of p7Groups) {
    const [from, to] = range.split("-").map(Number);
    for (let q = from; q <= to; q += 1) {
      rows.push(makeRow(7, q, {
        "Mã đoạn": `T05-${range}`, "Nội dung đoạn": `Passage text for T05-${range}`,
        "Tiêu đề đoạn": `Title T05-${range}`, "File ảnh": images.join("; "),
      }));
    }
  }
  return rows;
}

test("parseCsv handles quotes, commas, newlines, CRLF and BOM", () => {
  const rows = parseCsv("\uFEFFa,b\r\n\"x, y\",\"line1\nline2\"\r\n\"say \"\"hi\"\"\",z\r\n");
  assert.deepEqual(rows, [["a", "b"], ["x, y", "line1\nline2"], ["say \"hi\"", "z"]]);
});

test("mediaFileUrl expands bare names into bucket URLs", () => {
  assert.equal(
    mediaFileUrl("T05-01.mp3", "audio"),
    "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/toeic-media/T05-media/audio/T05-01.mp3",
  );
  assert.equal(
    mediaFileUrl("T05-P1-1.png", "image"),
    "https://fdyiixsxzhgwmicdfaos.supabase.co/storage/v1/object/public/toeic-media/T05-media/picture/T05-P1-1.png",
  );
});

test("buildTemplateCsv carries a BOM and every template header", () => {
  const template = buildTemplateCsv();
  assert.ok(template.startsWith("\uFEFF"));
  for (const header of CSV_TEMPLATE_HEADERS) assert.ok(template.includes(header));
});

test("a valid 200-row file builds a test that passes editor validation", () => {
  const result = buildTestFromCsv(toCsv(validRows()));
  assert.deepEqual(result.issues, []);
  assert.equal(result.suggestedTitle, "TOEIC Listening & Reading - Test 5");
  assert.equal(result.stats.audioCount, 54);
  assert.equal(result.stats.imageCount, 37);
  assert.deepEqual(validateEmployeeTest(result.test).errors, []);
  assert.equal(validateEmployeeTest(result.test).totalActualQuestions, 200);

  const part1 = result.test.parts[0];
  assert.ok(part1.questions[0].audioUrl.endsWith("/T05-media/audio/T05-01.mp3"));
  assert.ok(part1.questions[0].imageUrl.endsWith("/T05-media/picture/T05-P1-1.png"));
  const part3 = result.test.parts[2];
  assert.equal(part3.groups.length, 13);
  assert.equal(part3.groups[0].questionRange, "32-34");
  assert.ok(part3.groups[0].audioUrl.endsWith("/T05-media/audio/T05-32-34.mp3"));
  assert.equal(part3.groups[0].transcript, "Transcript of T05-32-34");
  const part6 = result.test.parts[5];
  assert.equal(part6.passages.length, 4);
  assert.ok(part6.passages[0].imageUrl.endsWith("/T05-media/picture/T05-P6-131-134.png"));
  const part7 = result.test.parts[6];
  assert.equal(part7.passageGroups.length, 15);
  const triple = part7.passageGroups.find((g) => g.groupNumber === 13);
  assert.equal(triple.imageUrls.length, 3);
  const payload = employeeTestPayload(result.test);
  assert.equal(payload.parts.length, 7);
});

test("missing template columns are reported and block the build", () => {
  const headers = CSV_TEMPLATE_HEADERS.filter((h) => h !== "File audio");
  const result = buildTestFromCsv(`${headers.join(",")}\r\n`);
  assert.equal(result.test, null);
  assert.ok(result.issues.some((i) => i.code === "employeeImportIssueHeader" && i.values.column === "File audio"));
});

test("row-level problems carry their CSV row and issue code", () => {
  const rows = [
    makeRow(1, 1, { "File audio": "T05-01.mp3" }), // no image -> P1 media missing
    makeRow(2, 7, { "File audio": "https://example.com/T05-07.mp3", "D": "Extra" }), // full URL + D answer
    makeRow(3, 32, { "Mã nhóm": "T05-32-34", "File audio": "T05-32-34.mp3" }),
    makeRow(3, 33, { "Mã nhóm": "T05-32-34", "File audio": "T05-35-37.mp3" }), // inconsistent group audio
    makeRow(3, 34, { "Mã nhóm": "T05-32-34", "File audio": "T05-32-34.mp3" }),
  ];
  const codes = buildTestFromCsv(toCsv(rows)).issues.map((i) => i.code);
  assert.ok(codes.includes("employeeImportIssueP1MediaMissing"));
  assert.ok(codes.includes("employeeImportIssueMediaNameInvalid"));
  assert.ok(codes.includes("employeeImportIssuePart2AnswerD"));
  assert.ok(codes.includes("employeeImportIssueGroupAudioInconsistent"));
  const dup = buildTestFromCsv(toCsv([makeRow(5, 101), makeRow(5, 101)])).issues;
  assert.ok(dup.some((i) => i.code === "employeeImportIssueQuestionDuplicate" && i.row === 3));
});

test("spreadsheet rows and CSV produce the same test with full media URLs", () => {
  const rows = validRows();
  const mediaRows = rows.map((row) => {
    const cells = row.map((value) => value === "" ? null : value);
    cells[17] = row[17] ? row[17].split("; ").map((name) => mediaFileUrl(name, "image")).join("\n") : null;
    cells[18] = row[18] ? mediaFileUrl(row[18], "audio") : null;
    return cells;
  });
  const expected = buildTestFromCsv(toCsv(rows));
  assert.ok(expected.test);
  assert.deepEqual(buildTestFromRows([CSV_TEMPLATE_HEADERS, ...mediaRows]), expected);
});

test("media URLs must match the configured bucket, folder and media type", () => {
  const rows = validRows();
  rows[0][17] = "https://example.com/T05-P1-1.png";
  rows[0][18] = mediaFileUrl("T05-01.mp3", "image");
  const { test: imported, issues } = buildTestFromRows([CSV_TEMPLATE_HEADERS, ...rows]);
  assert.equal(imported, null);
  assert.equal(issues.filter(({ code }) => code === "employeeImportIssueMediaNameInvalid").length, 2);
});

test("keeps multiline answer translations in the draft payload for CSV and Excel rows", () => {
  const rows = validRows();
  const translation = "A. Một\nB. Hai\nC. Ba\nD. Bốn";
  rows[0][CSV_TEMPLATE_HEADERS.indexOf("Dịch đáp án")] = translation;

  for (const result of [buildTestFromCsv(toCsv(rows)), buildTestFromRows([CSV_TEMPLATE_HEADERS, ...rows])]) {
    assert.deepEqual(result.issues, []);
    const [first, second] = employeeTestPayload(result.test).parts[0].questions;
    assert.equal(first.answerTranslation, translation);
    assert.equal(second.answerTranslation, undefined);
  }
});
