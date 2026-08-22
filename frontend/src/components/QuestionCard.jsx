import { getReviewParagraphs } from "../utils/reviewContent";

function ReviewContent({ children }) {
  return getReviewParagraphs(children).map((paragraph, index) => (
    <p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-pre-line">
      {paragraph}
    </p>
  ));
}

function QuestionCard({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  hideOptionContent = false,
  isFocused = false,
  compact = false,
  review = false,
}) {
  const questionTranslation =
    question.questionTranslation || question.translation;
  const detailedExplanation =
    question.detailedExplanation || question.explanation;
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
      ? "Select the statement that best describes the picture."
      : question.questionNumber <= 31
        ? "Select the best response to the question you hear."
        : "Select the best answer.");

  return (
    <article
      id={`question-${question.questionNumber}`}
      className={`${compact ? "rounded-xl border bg-white p-4 transition sm:p-5" : "rounded-2xl border bg-white p-5 shadow-sm transition sm:p-6"} ${statusClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-600">
            Question {question.questionNumber}
          </p>
          <h3 className={`${compact ? "mt-1.5 text-base leading-6" : "mt-2 text-base leading-7 sm:text-lg"} font-semibold text-slate-900`}>
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
              ? "Correct"
              : question.answerStatus === "INCORRECT"
                ? "Incorrect"
                : "Unanswered"}
          </span>
        )}
      </div>

      <div className={`${compact ? "mt-4 gap-2" : "mt-5 gap-3"} grid`}>
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
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-6 transition ${optionClass} ${
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
        <div className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
          <p>
            <strong>Correct answer:</strong> {question.correctAnswer}
            {question.selectedAnswer && (
              <>
                {" "}· <strong>Your answer:</strong> {question.selectedAnswer}
              </>
            )}
          </p>
          {questionTranslation && (
            <section className="rounded-lg border border-sky-100 bg-white p-4">
              <h4 className="font-bold text-sky-700">Question Translation</h4>
              <div className="mt-2 space-y-3 text-slate-700">
                <ReviewContent>{questionTranslation}</ReviewContent>
              </div>
            </section>
          )}
          {question.answerTranslation && (
            <section className="rounded-lg border border-emerald-100 bg-white p-4">
              <h4 className="font-bold text-emerald-700">Answer Translation</h4>
              <div className="mt-2 space-y-3 text-slate-700">
                <ReviewContent>{question.answerTranslation}</ReviewContent>
              </div>
            </section>
          )}
          <section className="rounded-lg border border-violet-100 bg-white p-4">
            <h4 className="font-bold text-violet-700">Detailed Explanation</h4>
            <div className="mt-2 space-y-3 text-slate-600">
              <ReviewContent>
                {detailedExplanation || "No detailed explanation is available for this question yet."}
              </ReviewContent>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

export default QuestionCard;
