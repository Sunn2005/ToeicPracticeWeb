
const DEFAULT_OPTIONS = ["A", "B", "C", "D"];

/**
 * AnswerOptionEditor
 *
 * @param {Array<{label: string, content: string}>} answers - list of choices
 * @param {string} correctAnswer - currently marked correct answer ('A' | 'B' | 'C' | 'D')
 * @param {function(string)} onSelectCorrect - callback when correct answer is chosen
 * @param {function(Array<{label: string, content: string}>)} onChangeAnswers - callback when answers change
 * @param {boolean} allowThreeOptions - if true, allows Part 2 (A, B, C)
 */
export default function AnswerOptionEditor({
  answers = [],
  correctAnswer = "A",
  onSelectCorrect,
  onChangeAnswers,
  allowThreeOptions = false,
}) {
  const labels = allowThreeOptions ? ["A", "B", "C"] : DEFAULT_OPTIONS;

  // Ensure all labels are present
  const normalizedAnswers = labels.map((label) => {
    const existing = answers.find((a) => a.label?.toUpperCase() === label);
    return existing || { label, content: "" };
  });

  const handleContentChange = (label, newContent) => {
    const nextAnswers = normalizedAnswers.map((item) =>
      item.label === label ? { ...item, content: newContent } : item
    );
    onChangeAnswers(nextAnswers);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-xs text-[#2188ee]">
            ★
          </span>
          Các lựa chọn trả lời
        </label>
        <span className="text-xs text-slate-500">
          Chọn nút tròn tương ứng với <strong className="text-emerald-600 font-semibold">Đáp án đúng</strong>
        </span>
      </div>

      <div className="space-y-3">
        {normalizedAnswers.map(({ label, content }) => {
          const isCorrect = correctAnswer?.toUpperCase() === label;

          return (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                isCorrect
                  ? "border-emerald-300 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-100"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectCorrect(label)}
                title={`Chọn ${label} làm đáp án đúng`}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-sm transition-all ${
                  isCorrect
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                    : "border border-slate-300 bg-slate-50 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                }`}
              >
                {label}
              </button>

              <div className="relative flex-1">
                <input
                  type="text"
                  value={content || ""}
                  onChange={(e) => handleContentChange(label, e.target.value)}
                  placeholder={`Nội dung lựa chọn (${label})...`}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {isCorrect && (
                <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  Đáp án đúng ✓
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
