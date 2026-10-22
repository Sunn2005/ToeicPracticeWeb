import { useMemo } from "react";

const STANDARD_COUNTS = {
  1: { name: "Phần 1: Hình ảnh", expected: 6, step: 2 },
  2: { name: "Phần 2: Hỏi - Đáp", expected: 25, step: 2 },
  3: { name: "Phần 3: Hội thoại", expected: 39, step: 2 },
  4: { name: "Phần 4: Bài nói ngắn", expected: 30, step: 2 },
  5: { name: "Phần 5: Điền câu", expected: 30, step: 3 },
  6: { name: "Phần 6: Điền đoạn văn", expected: 16, step: 3 },
  7: { name: "Phần 7: Đọc hiểu", expected: 54, step: 3 },
};

/**
 * TestValidationSummary (Wizard Step 4: Kiểm tra dữ liệu)
 *
 * @param {object} test - test object
 * @param {function(number, number, number)} onGoToStep - callback to jump to a specific wizard step (step, partNumber, questionNumber)
 * @param {function()} [onLoadMockTest] - callback to auto-populate 200 mock questions for quick test
 */
export default function TestValidationSummary({ test, onGoToStep, onLoadMockTest }) {
  // Compute counts per part
  const { partCounts, totalActualQuestions, errors, warnings } = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    const errs = [];
    const warns = [];

    // Title validation
    if (!test?.title?.trim()) {
      errs.push({
        id: "missing-title",
        type: "error",
        title: "Chưa đặt tên đề thi",
        message: "Tên đề thi là bắt buộc để học viên nhận biết.",
        step: 1,
      });
    }

    // Description validation
    if (!test?.description?.trim() || test.description.length < 20) {
      warns.push({
        id: "short-description",
        type: "warning",
        title: "Mô tả đề thi quá ngắn",
        message: "Mô tả đề thi dưới 20 ký tự. Nên bổ sung thông tin chi tiết cho học viên.",
        step: 1,
      });
    }

    const parts = test?.parts || [];

    // Tally questions and scan for question-level errors
    parts.forEach((p) => {
      const pNum = p.partNumber;

      // Part 1, 2, 5
      if (Array.isArray(p.questions)) {
        counts[pNum] = (counts[pNum] || 0) + p.questions.length;

        p.questions.forEach((q) => {
          if (!q.correctAnswer) {
            errs.push({
              id: `q-no-correct-${q.questionNumber}`,
              type: "error",
              title: `Câu ${q.questionNumber} (Part ${pNum}) thiếu đáp án đúng`,
              message: "Chưa chọn đáp án đúng (A, B, C, D) cho câu hỏi này.",
              step: pNum <= 4 ? 2 : 3,
              partNumber: pNum,
              questionNumber: q.questionNumber,
            });
          }
          if (pNum === 1 && !q.imageUrl) {
            warns.push({
              id: `q-no-img-${q.questionNumber}`,
              type: "warning",
              title: `Câu ${q.questionNumber} (Part 1) thiếu hình ảnh`,
              message: "Part 1 yêu cầu hình ảnh minh họa cho tranh.",
              step: 2,
              partNumber: pNum,
              questionNumber: q.questionNumber,
            });
          }
          if ((pNum === 1 || pNum === 2) && !q.audioUrl) {
            warns.push({
              id: `q-no-audio-${q.questionNumber}`,
              type: "warning",
              title: `Câu ${q.questionNumber} (Part ${pNum}) chưa có audio`,
              message: "Câu hỏi nghe cần có tệp âm thanh.",
              step: 2,
              partNumber: pNum,
              questionNumber: q.questionNumber,
            });
          }
          if (!q.explanation) {
            warns.push({
              id: `q-no-exp-${q.questionNumber}`,
              type: "warning",
              title: `Câu ${q.questionNumber} (Part ${pNum}) thiếu lời giải chi tiết`,
              message: "Học viên sẽ không thấy giải thích ngữ pháp/dấu hiệu sau khi nộp bài.",
              step: pNum <= 4 ? 2 : 3,
              partNumber: pNum,
              questionNumber: q.questionNumber,
            });
          }
        });
      }

      // Part 3, 4 (groups)
      if (Array.isArray(p.groups)) {
        p.groups.forEach((g) => {
          const qCount = (g.questions || []).length;
          counts[pNum] = (counts[pNum] || 0) + qCount;

          if (!g.audioUrl) {
            warns.push({
              id: `group-no-audio-${g.questionRange}`,
              type: "warning",
              title: `Nhóm ${g.questionRange || "mới"} (Part ${pNum}) chưa có audio`,
              message: "Nhóm nghe cần tệp âm thanh hội thoại / bài nói.",
              step: 2,
              partNumber: pNum,
              questionNumber: g.questions?.[0]?.questionNumber,
            });
          }
          (g.questions || []).forEach((q) => {
            if (!q.correctAnswer) {
              errs.push({
                id: `q-no-correct-${q.questionNumber}`,
                type: "error",
                title: `Câu ${q.questionNumber} (Part ${pNum}) thiếu đáp án đúng`,
                message: "Chưa chọn đáp án đúng cho câu hỏi này.",
                step: 2,
                partNumber: pNum,
                questionNumber: q.questionNumber,
              });
            }
          });
        });
      }

      // Part 6 (passages)
      if (Array.isArray(p.passages)) {
        p.passages.forEach((pass) => {
          const qCount = (pass.questions || []).length;
          counts[pNum] = (counts[pNum] || 0) + qCount;

          if (!pass.text?.trim()) {
            errs.push({
              id: `p6-no-text-${pass.passageNumber}`,
              type: "error",
              title: `Đoạn văn ${pass.passageNumber} (Part 6) trống nội dung`,
              message: "Vui lòng nhập văn bản bài đọc cho đoạn này.",
              step: 3,
              partNumber: pNum,
              questionNumber: pass.questions?.[0]?.questionNumber,
            });
          }
          (pass.questions || []).forEach((q) => {
            if (!q.correctAnswer) {
              errs.push({
                id: `q-no-correct-${q.questionNumber}`,
                type: "error",
                title: `Câu ${q.questionNumber} (Part 6) thiếu đáp án đúng`,
                message: "Chưa chọn đáp án đúng.",
                step: 3,
                partNumber: pNum,
                questionNumber: q.questionNumber,
              });
            }
          });
        });
      }

      // Part 7 (passageGroups)
      if (Array.isArray(p.passageGroups)) {
        p.passageGroups.forEach((g) => {
          const qCount = (g.questions || []).length;
          counts[pNum] = (counts[pNum] || 0) + qCount;

          const hasPassageText = g.passages?.some((item) => item.text?.trim());
          const hasImage = (g.imageUrls || []).length > 0;
          if (!hasPassageText && !hasImage) {
            errs.push({
              id: `p7-no-content-${g.groupNumber}`,
              type: "error",
              title: `Bài đọc ${g.groupNumber} (Part 7) chưa có văn bản hoặc hình ảnh`,
              message: "Vui lòng thêm nội dung bài đọc hoặc ảnh tài liệu.",
              step: 3,
              partNumber: pNum,
              questionNumber: g.questions?.[0]?.questionNumber,
            });
          }
          (g.questions || []).forEach((q) => {
            if (!q.correctAnswer) {
              errs.push({
                id: `q-no-correct-${q.questionNumber}`,
                type: "error",
                title: `Câu ${q.questionNumber} (Part 7) thiếu đáp án đúng`,
                message: "Chưa chọn đáp án đúng.",
                step: 3,
                partNumber: pNum,
                questionNumber: q.questionNumber,
              });
            }
          });
        });
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    // Question count notice: if Full Test has less than 200 questions, add a helpful warning
    if (test?.type === "FULL_TEST" && total < 200) {
      warns.unshift({
        id: "not-enough-questions-full",
        type: "warning",
        title: `Đề thi Full Test hiện có ${total} / 200 câu hỏi`,
        message:
          "Bạn có thể tiếp tục bổ sung thêm câu hỏi hoặc bấm nút 'Nạp đề mẫu 200 câu' để kiểm thử nhanh toàn bộ luồng.",
        step: 2,
        partNumber: 1,
      });
    }

    return {
      partCounts: counts,
      totalActualQuestions: total,
      errors: errs,
      warnings: warns,
    };
  }, [test]);

  const isValid = errors.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Kiểm tra tính hợp lệ của đề thi
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isValid
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {isValid ? "✓ Đạt tiêu chuẩn gửi duyệt" : `⚠️ Có ${errors.length} lỗi cần sửa`}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Hệ thống tự động rà soát câu hỏi, đáp án, tệp nghe và cấu trúc để đảm bảo đề thi đạt chất lượng tốt nhất.
          </p>
        </div>

        {onLoadMockTest && (
          <button
            type="button"
            onClick={onLoadMockTest}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-sm transition"
          >
            <span>⚡</span> Nạp đề mẫu 200 câu (Dev Test)
          </button>
        )}
      </div>

      {/* Bento Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left: Issues List */}
        <div className="space-y-4 lg:col-span-8">
          {errors.length === 0 && warnings.length === 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center shadow-xs">
              <span className="text-4xl">🎉</span>
              <h3 className="mt-3 text-lg font-bold text-emerald-900">
                Tất cả dữ liệu hoàn toàn hợp lệ!
              </h3>
              <p className="mt-1 text-sm text-emerald-700">
                Đề thi đã được điền đầy đủ thông tin, câu hỏi và đáp án đúng. Bạn có thể sang bước Xem trước.
              </p>
            </div>
          )}

          {/* Errors list */}
          {errors.map((err) => (
            <div
              key={err.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-white p-5 shadow-xs transition hover:border-red-400"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-sm font-bold text-red-700">
                  ✕
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {err.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-600">
                    {err.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onGoToStep?.(err.step, err.partNumber, err.questionNumber)}
                className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
              >
                Sửa lỗi →
              </button>
            </div>
          ))}

          {/* Warnings list */}
          {warnings.map((warn) => (
            <div
              key={warn.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-white p-5 shadow-xs transition hover:border-amber-400"
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-800">
                  ⚠️
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {warn.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-600">
                    {warn.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onGoToStep?.(warn.step, warn.partNumber, warn.questionNumber)}
                className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition"
              >
                Xem chi tiết →
              </button>
            </div>
          ))}
        </div>

        {/* Right: Summary Panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4 sticky top-24">
          <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">
            Tổng quan cấu trúc đề
          </h3>

          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((num) => {
              const info = STANDARD_COUNTS[num];
              const count = partCounts[num] || 0;
              const matchesExpected = count === info.expected;

              return (
                <div
                  key={num}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-slate-600">
                    {info.name}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span
                      className={`font-bold ${
                        matchesExpected ? "text-slate-900" : "text-amber-600"
                      }`}
                    >
                      {count} / {info.expected}
                    </span>
                    {matchesExpected ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-amber-500">●</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-900">
              Tổng số câu hỏi:
            </span>
            <span className="font-bold text-base text-blue-700 font-mono">
              {totalActualQuestions} / {test?.totalQuestions || 200}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => onGoToStep?.(5)}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-200 transition"
            >
              Tiếp tục sang Xem trước →
            </button>

            {onLoadMockTest && (
              <button
                type="button"
                onClick={onLoadMockTest}
                className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-slate-50 transition"
              >
                ⚡ Điền tự động 200 câu mẫu
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
