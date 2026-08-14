function QuestionCard({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  hideOptionContent = false,
  isFocused = false,
  review = false,
}) {
  const statusClass = review
    ? question.answerStatus === "CORRECT"
      ? "border-emerald-300 bg-emerald-50/50"
      : question.answerStatus === "INCORRECT"
        ? "border-red-300 bg-red-50/40"
        : "border-amber-300 bg-amber-50/40"
    : isFocused
      ? "border-sky-400 ring-4 ring-sky-100"
      : "border-slate-200";

  const prompt =
    question.question ||
    (question.questionNumber <= 6
      ? "Chọn phương án mô tả đúng nhất cho bức ảnh."
      : question.questionNumber <= 31
        ? "Chọn câu trả lời phù hợp nhất với câu hỏi bạn nghe."
        : "Chọn đáp án đúng.");

  return (
    <article
      id={`question-${question.questionNumber}`}
      className={`rounded-2xl border bg-white p-5 shadow-sm transition sm:p-6 ${statusClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-600">
            Câu {question.questionNumber}
          </p>
          {question.description && (
            <p className="mt-2 text-sm italic text-slate-500">
              {question.description}
            </p>
          )}
          <h3 className="mt-2 text-base font-semibold leading-7 text-slate-900 sm:text-lg">
            {prompt}
          </h3>
        </div>
        {review && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
              question.answerStatus === "CORRECT"
                ? "bg-emerald-100 text-emerald-700"
                : question.answerStatus === "INCORRECT"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {question.answerStatus === "CORRECT"
              ? "Đúng"
              : question.answerStatus === "INCORRECT"
                ? "Sai"
                : "Bỏ trống"}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        {(question.answers || []).map((answer) => {
          const isSelected = selectedAnswer === answer.label;
          const isCorrect = review && question.correctAnswer === answer.label;
          const optionClass = review
            ? isCorrect
              ? "border-emerald-400 bg-emerald-50 text-emerald-900"
              : isSelected
                ? "border-red-400 bg-red-50 text-red-900"
                : "border-slate-200 bg-white text-slate-600"
            : isSelected
              ? "border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-100"
              : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/50";

          return (
            <label
              key={answer.label}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 transition ${optionClass} ${
                disabled ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <input
                type="radio"
                name={`question-${question.questionNumber}`}
                value={answer.label}
                checked={isSelected}
                onChange={() => onSelect?.(answer.label)}
                disabled={disabled}
                className="mt-1 h-4 w-4 accent-sky-600"
              />
              <span>
                <strong className="mr-2">{answer.label}.</strong>
                {!hideOptionContent && answer.content}
              </span>
            </label>
          );
        })}
      </div>

      {review && (
        <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
          <p>
            <strong>Đáp án đúng:</strong> {question.correctAnswer}
            {question.selectedAnswer && (
              <>
                {" "}· <strong>Bạn chọn:</strong> {question.selectedAnswer}
              </>
            )}
          </p>
          <p className="text-slate-600">
            <strong>Giải thích:</strong>{" "}
            {question.explanation || "Chưa có lời giải chi tiết cho câu này."}
          </p>
        </div>
      )}
    </article>
  );
}

export default QuestionCard;
