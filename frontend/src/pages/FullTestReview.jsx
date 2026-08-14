import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import PassagePanel from "../components/PassagePanel";
import QuestionCard from "../components/QuestionCard";
import { getAllQuestions } from "../utils/testData";

const FILTERS = [
  ["ALL", "Tất cả"],
  ["CORRECT", "Câu đúng"],
  ["INCORRECT", "Câu sai"],
  ["UNANSWERED", "Bỏ trống"],
];

function FullTestReview() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch(`/api/attempts/${attemptId}/review`)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const allQuestions = useMemo(() => getAllQuestions(data?.test), [data?.test]);
  const filteredQuestions = useMemo(
    () =>
      filter === "ALL"
        ? allQuestions
        : allQuestions.filter(({ question }) => question.answerStatus === filter),
    [allQuestions, filter],
  );

  const current = filteredQuestions[currentIndex];

  if (!data && !error) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">Đang tải bài review...</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      </div>
    );
  }

  const unit = current?.unit;
  const question = current?.question;
  const imageUrl = unit?.imageUrl || question?.imageUrl;
  const audioUrl = unit?.audioUrl || question?.audioUrl;
  const transcript = unit?.transcript || question?.transcript;
  const questionsToDisplay = [3, 4].includes(unit?.partNumber)
    ? unit.questions
    : [question];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Review Full Test</p>
            <h1 className="mt-1 text-lg font-bold">Xem lại đáp án · {data.result.totalScore}/990</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/full-test/${attemptId}/result`)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kết quả
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <div className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([value, label]) => {
              const count =
                value === "ALL"
                  ? allQuestions.length
                  : allQuestions.filter(({ question: item }) => item.answerStatus === value).length;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFilter(value);
                    setCurrentIndex(0);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    filter === value
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {filteredQuestions.length ? `${currentIndex + 1}/${filteredQuestions.length}` : "0 câu"}
          </p>
        </div>

        {!current ? (
          <div className="rounded-2xl bg-white p-10 text-center text-slate-500">
            Không có câu hỏi thuộc bộ lọc này.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="min-w-0 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
                  Part {unit.partNumber} · {unit.partName}
                </p>
              </div>

              {audioUrl && (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <p className="mb-3 text-sm font-semibold text-sky-800">Nghe lại audio</p>
                  <audio key={audioUrl} src={audioUrl} controls className="w-full" />
                </div>
              )}

              {imageUrl && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                  <img src={imageUrl} alt="Hình minh họa" className="mx-auto max-h-[520px] rounded-xl object-contain" />
                </div>
              )}

              <PassagePanel passages={unit.passages || []} />

              {transcript && (
                <details className="rounded-2xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer font-bold text-slate-800">Transcript</summary>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{transcript}</p>
                </details>
              )}

              <div className="space-y-4">
                {questionsToDisplay.map((item) => (
                  <QuestionCard
                    key={item.questionNumber}
                    question={item}
                    selectedAnswer={item.selectedAnswer}
                    disabled
                    review
                    isFocused={item.questionNumber === question.questionNumber}
                  />
                ))}
              </div>

              <div className="flex justify-between pb-8">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 disabled:opacity-40"
                >
                  ← Câu trước
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.min(filteredQuestions.length - 1, index + 1))}
                  disabled={currentIndex >= filteredQuestions.length - 1}
                  className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white disabled:opacity-40"
                >
                  Câu tiếp →
                </button>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
              <p className="px-1 text-sm font-bold">Danh sách đang lọc</p>
              <div className="mt-4 grid max-h-[70vh] grid-cols-5 gap-2 overflow-y-auto p-1">
                {filteredQuestions.map(({ question: item }, index) => (
                  <button
                    key={item.questionNumber}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={`aspect-square rounded-lg text-xs font-bold ${
                      index === currentIndex
                        ? "bg-sky-600 text-white ring-2 ring-sky-200"
                        : item.answerStatus === "CORRECT"
                          ? "bg-emerald-100 text-emerald-700"
                          : item.answerStatus === "INCORRECT"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.questionNumber}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default FullTestReview;
