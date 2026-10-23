import { useState, useMemo } from "react";
import { buildAllUnits } from "../../utils/testData";

/**
 * TestPreview (Wizard Step 5: Xem trước đề thi)
 *
 * @param {object} test - test object
 */
export default function TestPreview({ test }) {
  const [activePart, setActivePart] = useState(1);
  const [showAnswersMode, setShowAnswersMode] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState({});

  const units = useMemo(() => {
    return buildAllUnits(test);
  }, [test]);

  const partUnits = useMemo(() => {
    return units.filter((u) => u.partNumber === activePart);
  }, [units, activePart]);

  const handleSelectAnswer = (qNum, label) => {
    setSelectedAnswers((prev) => ({ ...prev, [qNum]: label }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Control Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
            Chế độ Xem trước
          </span>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {test?.title || "Bản nháp đề thi"}
          </h2>
          <p className="text-xs text-slate-500">
            {test?.type === "PRACTICE" ? "Mini Test" : "Full Test"} · {test?.totalQuestions || 200} câu hỏi · {test?.totalMinutes || 120} phút
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700">
            <input
              type="checkbox"
              checked={showAnswersMode}
              onChange={(e) => setShowAnswersMode(e.target.checked)}
              className="h-4 w-4 rounded accent-blue-600"
            />
            Hiện đáp án đúng & lời giải
          </label>
        </div>
      </div>

      {/* Part Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => setActivePart(num)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activePart === num
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Part {num}
          </button>
        ))}
      </div>

      {/* Questions Preview Canvas */}
      <div className="space-y-6">
        {partUnits.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
            Part {activePart} chưa có câu hỏi nào. Bạn có thể quay lại bước soạn thảo để thêm câu hỏi.
          </div>
        ) : (
          partUnits.map((unit) => {
            return (
              <div
                key={unit.key}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
              >
                {/* Unit Header / Media */}
                {(unit.audioUrl || unit.imageUrl || unit.content || unit.passages) && (
                  <div className="space-y-4 border-b border-slate-100 pb-5">
                    {/* Audio */}
                    {unit.audioUrl && (
                      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                        <span className="text-xl">🎧</span>
                        <div className="flex-1">
                          <audio
                            controls
                            src={unit.audioUrl}
                            className="h-8 w-full"
                          />
                        </div>
                      </div>
                    )}

                    {/* Image */}
                    {unit.imageUrl && (
                      <div className="max-h-72 overflow-hidden rounded-xl bg-slate-50 border border-slate-200 flex justify-center">
                        <img
                          src={unit.imageUrl}
                          alt="Ảnh câu hỏi"
                          className="max-h-72 object-contain"
                          onError={(e) => {
                            e.currentTarget.src = "https://placehold.co/500x300?text=H%C3%ACnh+%E1%BA%A3nh";
                          }}
                        />
                      </div>
                    )}

                    {/* Document Images (Part 7) */}
                    {(unit.imageUrls || []).length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {unit.imageUrls.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt={`Tài liệu ${i + 1}`}
                            className="max-h-60 rounded-lg border border-slate-200 object-contain"
                          />
                        ))}
                      </div>
                    )}

                    {/* Passage text (Part 6 & 7) */}
                    {(unit.content || unit.passages) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 font-mono text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                        {unit.content ||
                          unit.passages?.map((p, i) => (
                            <div key={i} className="mb-4 last:mb-0">
                              {p.title && (
                                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                                  {p.title}
                                </h4>
                              )}
                              <p>{p.content}</p>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Transcript translation if in answer mode */}
                    {showAnswersMode && (unit.transcript || unit.transcriptTranslation) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                        <span className="font-bold text-slate-700">Transcript:</span>
                        {unit.transcript && (
                          <p className="text-slate-800 italic">"{unit.transcript}"</p>
                        )}
                        {unit.transcriptTranslation && (
                          <p className="text-slate-600">Dịch: {unit.transcriptTranslation}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Questions inside this unit */}
                <div className="space-y-6">
                  {(unit.questions || []).map((q) => {
                    const selected = selectedAnswers[q.questionNumber];

                    return (
                      <div
                        key={q.questionNumber}
                        className={`rounded-xl border p-5 transition ${
                          showAnswersMode
                            ? "border-slate-200 bg-white"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                              Câu {q.questionNumber}
                            </span>
                            <h3 className="mt-1 text-base font-semibold text-slate-900">
                              {q.question || "Select the best answer."}
                            </h3>
                            {showAnswersMode && (q.questionTranslation || q.translation) && (
                              <p className="mt-1 text-xs text-slate-500 italic">
                                ({q.questionTranslation || q.translation})
                              </p>
                            )}
                          </div>

                          {showAnswersMode && (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                              Đáp án: {q.correctAnswer}
                            </span>
                          )}
                        </div>

                        {/* Options */}
                        <div className="mt-4 grid gap-2.5">
                          {(q.answers || []).map((ans) => {
                            const isCorrect = ans.label === q.correctAnswer;
                            const isSelected = selected === ans.label;

                            let optionClasses =
                              "border-slate-200 bg-white text-slate-700 hover:border-blue-300";

                            if (showAnswersMode) {
                              if (isCorrect) {
                                optionClasses =
                                  "border-emerald-400 bg-emerald-50/70 text-emerald-950 font-medium ring-1 ring-emerald-200";
                              } else if (isSelected) {
                                optionClasses = "border-red-300 bg-red-50 text-red-900";
                              }
                            } else if (isSelected) {
                              optionClasses =
                                "border-blue-500 bg-blue-50 text-blue-950 font-medium ring-2 ring-blue-100";
                            }

                            return (
                              <label
                                key={ans.label}
                                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${optionClasses}`}
                              >
                                <input
                                  type="radio"
                                  name={`preview-q-${q.questionNumber}`}
                                  value={ans.label}
                                  checked={isSelected}
                                  onChange={() =>
                                    handleSelectAnswer(q.questionNumber, ans.label)
                                  }
                                  className="h-4 w-4 accent-blue-600"
                                />
                                <span className="font-bold text-xs">
                                  ({ans.label})
                                </span>
                                <span>{ans.content || `Option ${ans.label}`}</span>
                                {showAnswersMode && isCorrect && (
                                  <span className="ml-auto text-xs font-bold text-emerald-700">
                                    ✓ Đúng
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>

                        {/* Explanation in answers mode */}
                        {showAnswersMode && (q.explanation || q.detailedExplanation) && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-1">
                            <span className="font-bold text-slate-900">
                              Giải thích:
                            </span>
                            <p>{q.explanation || q.detailedExplanation}</p>
                            {q.explanationTranslation && (
                              <p className="text-slate-500 italic">
                                {q.explanationTranslation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
