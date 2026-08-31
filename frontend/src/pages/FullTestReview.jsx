import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import ExamNavigationBar from "../components/ExamNavigationBar";
import PassagePanel from "../components/PassagePanel";
import QuestionCard from "../components/QuestionCard";
import QuestionNavigatorDrawer from "../components/QuestionNavigatorDrawer";
import ResizableExamLayout from "../components/ResizableExamLayout";
import ReviewTogglePanel from "../components/ReviewTogglePanel";
import { getAllQuestions } from "../utils/testData";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import { deleteAttempt } from "../api/userLearning";

const FILTERS = [
  ["ALL", "all"],
  ["CORRECT", "correct"],
  ["INCORRECT", "incorrect"],
  ["UNANSWERED", "unanswered"],
];

function modeLabel(attempt, t) {
  const selectedParts = attempt.selectedParts?.length
    ? attempt.selectedParts
    : attempt.selectedPart
      ? [attempt.selectedPart]
      : [];

  if (attempt.type === "PRACTICE") {
    return `${t("practiceMode")} · ${t("part")} ${selectedParts.join(" + ")}`;
  }
  if (attempt.mode === "FULL") return t("fullTest");
  if (attempt.mode === "PART") return `${t("part")} ${selectedParts.join(" + ")}`;
  return attempt.mode === "LISTENING" ? t("listeningTest") : t("readingTest");
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

function ReviewHeader({ data, currentPart, maxScore, onResults, onDashboard, onDelete }) {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">
            {data.test.title || "Test 1"} · {t("answerReview")} · {modeLabel(data.attempt, t)}
          </p>
          <p className="truncate text-xs font-medium text-slate-500">
            {t("answerReview")}{currentPart ? ` · ${t("part")} ${currentPart}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-center text-emerald-800 ring-1 ring-emerald-200 sm:px-4">
            <p className="hidden text-[9px] font-semibold uppercase tracking-widest opacity-70 sm:block">
              {t("score")}
            </p>
            <p className="text-sm font-bold tabular-nums sm:text-base">
              {data.result.totalScore}/{maxScore}
            </p>
          </div>
          <button
            type="button"
            onClick={onResults}
            className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:block sm:px-4 sm:text-sm"
          >
            {t("results")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("delete")}
            title={t("delete")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-700"
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            onClick={onDashboard}
            className="hidden rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 sm:block sm:px-4 sm:text-sm"
          >
            {t("dashboard")}
          </button>
        </div>
      </div>
    </header>
  );
}

function ReviewDeleteDialog({ open, deleting, error, onCancel, onConfirm }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5">
      <section role="alertdialog" aria-modal="true" aria-labelledby="review-delete-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600"><TrashIcon /></span>
        <h2 id="review-delete-title" className="mt-5 text-xl font-bold text-slate-950">{t("deleteAttemptTitle")}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{t("deleteAttemptDescription")}</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:bg-red-300">{deleting ? t("deleting") : t("delete")}</button>
        </div>
      </section>
    </div>
  );
}

function ReviewAudio({ src }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3.5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
          ♫
        </span>
        <div>
          <p className="text-sm font-bold text-sky-900">{t("replayAudio")}</p>
          <p className="mt-0.5 text-xs leading-5 text-sky-700">
            {t("replayAudioNote")}
          </p>
        </div>
      </div>
      <audio key={src} src={src} controls preload="metadata" className="w-full" />
    </section>
  );
}

function FullTestReview() {
  const { t } = useLanguage();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedFilter = searchParams.get("filter")?.toUpperCase();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(
    FILTERS.some(([value]) => value === requestedFilter) ? requestedFilter : "ALL",
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNavigator, setShowNavigator] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const questionPanelRef = useRef(null);
  const mediaPanelRef = useRef(null);

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

  const allQuestions = useMemo(() => {
    const first = data?.attempt?.firstQuestionNumber || 1;
    const last = data?.attempt?.lastQuestionNumber || 200;
    const selectedParts = data?.attempt?.selectedParts?.length
      ? data.attempt.selectedParts
      : data?.attempt?.selectedPart
        ? [data.attempt.selectedPart]
        : null;

    return getAllQuestions(data?.test).filter(
      ({ question, partNumber }) => question.questionNumber >= first
        && question.questionNumber <= last
        && (!selectedParts || selectedParts.includes(partNumber)),
    );
  }, [data]);

  const filteredQuestions = useMemo(
    () => filter === "ALL"
      ? allQuestions
      : allQuestions.filter(({ question }) => question.answerStatus === filter),
    [allQuestions, filter],
  );

  const current = filteredQuestions[currentIndex];
  const currentQuestionNumber = current?.question.questionNumber;
  const currentUnitKey = current?.unit.key;

  useEffect(() => {
    mediaPanelRef.current?.scrollTo({ top: 0 });
  }, [currentUnitKey]);

  useEffect(() => {
    if (!currentQuestionNumber) return;
    questionPanelRef.current
      ?.querySelector(`#question-${currentQuestionNumber}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentQuestionNumber]);

  const navigatorGroups = useMemo(() => {
    const groups = new Map();
    filteredQuestions.forEach(({ partNumber, unit, question }) => {
      const group = groups.get(partNumber) || {
        partNumber,
        partName: unit.partName,
        questions: [],
      };
      group.questions.push(question.questionNumber);
      groups.set(partNumber, group);
    });
    return [...groups.values()];
  }, [filteredQuestions]);

  const questionStatuses = useMemo(() => Object.fromEntries(
    allQuestions.map(({ question }) => [question.questionNumber, question.answerStatus]),
  ), [allQuestions]);

  const selectedAnswers = useMemo(() => Object.fromEntries(
    allQuestions.map(({ question }) => [question.questionNumber, question.selectedAnswer]),
  ), [allQuestions]);

  if (!data && !error) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">{t("loadingReview")}</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-bold">{t("unableOpenReview")}</p>
          <p className="mt-2 text-sm leading-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-5 rounded-xl bg-white px-4 py-2 font-semibold text-slate-700"
          >
            {t("returnToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  const hasListening = data.result.listeningTotalQuestions > 0;
  const hasReading = data.result.readingTotalQuestions > 0;
  const maxScore = data.attempt.mode === "FULL" || (hasListening && hasReading) ? 990 : 495;
  const unit = current?.unit;
  const question = current?.question;
  const questionsToDisplay = [3, 4].includes(unit?.partNumber)
    ? unit.questions
    : question
      ? [question]
      : [];
  const imageUrl = unit?.imageUrl || question?.imageUrl;
  const audioUrl = unit?.audioUrl || question?.audioUrl;
  const passagePanelImageUrls = new Set([
    ...(unit?.imageUrls || []),
    ...(unit?.passages || []).map((passage) => passage.imageUrl),
  ].filter(Boolean));
  const shouldRenderStandaloneImage = imageUrl && !passagePanelImageUrls.has(imageUrl);
  const showListeningReview = [3, 4].includes(unit?.partNumber);
  const transcript = showListeningReview ? unit?.transcript : null;
  const transcriptTranslation = showListeningReview ? unit?.transcriptTranslation : null;
  const hasMedia = Boolean(
    audioUrl
    || imageUrl
    || unit?.imageUrls?.length
    || unit?.passages?.length
    || transcript
    || transcriptTranslation,
  );
  const filterKey = FILTERS.find(([value]) => value === filter)?.[1] || "all";
  const filterLabel = t(filterKey);

  const selectQuestion = (questionNumber) => {
    const index = filteredQuestions.findIndex(
      ({ question: item }) => item.questionNumber === questionNumber,
    );
    if (index >= 0) setCurrentIndex(index);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAttempt(attemptId);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setDeleteError(requestError.message || t("historyDeleteError"));
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ReviewHeader
        data={data}
        currentPart={unit?.partNumber}
        maxScore={maxScore}
        onResults={() => navigate(`/full-test/${attemptId}/result`)}
        onDashboard={() => navigate("/dashboard")}
        onDelete={() => setShowDelete(true)}
      />

      <main className="w-full px-3 py-3 pb-28 sm:px-5 lg:px-6 xl:pb-5">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-base font-bold text-slate-950 sm:text-lg">
                {unit
                  ? `${unit.start === unit.end ? t("question") : t("questions")} ${unit.start}${unit.end !== unit.start ? `–${unit.end}` : ""}`
                  : t("answerReviewTitle")}
              </h1>
              {unit && (
                <p className="mt-0.5 text-xs font-semibold text-sky-700">
                  {t("part")} {unit.partNumber} · {unit.partName}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map(([value, labelKey]) => {
                const count = value === "ALL"
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
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                      filter === value
                        ? "bg-sky-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"
                    }`}
                  >
                    {t(labelKey)} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {!current ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              {t("noQuestionsFilter")}
            </div>
          ) : (
            <ResizableExamLayout
              leftLabel={t("audioPassagesTranscripts")}
              rightLabel={t("questionsTranslationsExplanations")}
              left={(
                <section
                  ref={mediaPanelRef}
                  aria-label={t("audioPassagesTranscripts")}
                  className="min-w-0 space-y-3 xl:h-[calc(100dvh-10.5rem)] xl:overflow-y-auto xl:pr-1"
                >
                  {audioUrl && <ReviewAudio src={audioUrl} />}

                  {shouldRenderStandaloneImage && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <img
                        src={imageUrl}
                        alt={`Material for questions ${unit.start} to ${unit.end}`}
                        className="mx-auto h-auto max-h-[65vh] max-w-full rounded-xl object-contain"
                      />
                    </div>
                  )}

                  <PassagePanel
                    compact
                    passages={unit.passages || []}
                    imageUrls={unit.imageUrls || []}
                  />

                  {transcript && (
                    <ReviewTogglePanel title={t("transcript")} icon="▤" tone="sky">
                      <p className="whitespace-pre-wrap">{transcript}</p>
                    </ReviewTogglePanel>
                  )}

                  {transcriptTranslation && (
                    <ReviewTogglePanel title={t("transcriptTranslation")} icon="文" tone="sky">
                      <p className="whitespace-pre-wrap">{transcriptTranslation}</p>
                    </ReviewTogglePanel>
                  )}

                  {!hasMedia && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-6 text-slate-500">
                      {t("reviewNoMedia")}
                    </div>
                  )}
                </section>
              )}
              right={(
                <section className="min-w-0 xl:flex xl:h-[calc(100dvh-10.5rem)] xl:flex-col xl:pl-1">
                  <div
                    ref={questionPanelRef}
                    aria-label={t("questionsTranslationsExplanations")}
                    className="min-w-0 space-y-3 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                  >
                    {questionsToDisplay.map((item) => (
                      <QuestionCard
                        key={item.questionNumber}
                        question={item}
                        selectedAnswer={item.selectedAnswer}
                        disabled
                        review
                        compact
                        isFocused={item.questionNumber === question.questionNumber}
                      />
                    ))}
                  </div>

                  <ExamNavigationBar
                    progressLabel={`${currentIndex + 1}/${filteredQuestions.length}`}
                    onOpenNavigator={() => setShowNavigator(true)}
                    onPrevious={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                    onNext={() => setCurrentIndex((index) => Math.min(filteredQuestions.length - 1, index + 1))}
                    onSubmit={() => navigate(`/full-test/${attemptId}/result`)}
                    previousDisabled={currentIndex === 0}
                    nextDisabled={currentIndex >= filteredQuestions.length - 1}
                    submitLabel={t("results")}
                    submitVariant="secondary"
                    statusMessage={`${t("showing")} ${filterLabel.toLowerCase()} · ${t("part")} ${unit.partNumber}`}
                  />
                </section>
              )}
            />
          )}
        </section>
      </main>

      <QuestionNavigatorDrawer
        open={showNavigator}
        onClose={() => setShowNavigator(false)}
        groups={navigatorGroups}
        currentQuestion={currentQuestionNumber}
        answers={selectedAnswers}
        questionStatuses={questionStatuses}
        reviewMode
        title={`${t("questionNavigator")} · ${filterLabel}`}
        onSelect={selectQuestion}
      />

      <ReviewDeleteDialog
        open={showDelete}
        deleting={deleting}
        error={deleteError}
        onCancel={() => {
          setShowDelete(false);
          setDeleteError("");
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default FullTestReview;
