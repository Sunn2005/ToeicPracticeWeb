import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { getAttemptDurationSeconds, getAttemptParts } from "../utils/attemptHistory";

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function AttemptHistoryCard({ attempt, test, onDelete, onReview, onReviewIncorrect }) {
  const { language, t } = useLanguage();
  const completed = attempt.status === "COMPLETED";
  const isPractice = attempt.type === "PRACTICE";
  const parts = getAttemptParts(attempt);
  const result = attempt.result || {};
  const correct = Number(result.totalCorrect) || 0;
  const wrong = Number(result.totalWrong) || 0;
  const unanswered = Number(result.totalUnanswered) || 0;
  const timestamp = attempt.submittedAt || attempt.updatedAt || attempt.startedAt;
  const attemptDate = new Date(Number(timestamp));
  const date = Number.isNaN(attemptDate.getTime())
    ? "—"
    : new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(attemptDate);
  const durationMinutes = Math.max(
    0,
    Math.round((Number(result.durationSeconds) || getAttemptDurationSeconds(attempt)) / 60),
  );

  return (
    <article
      onClick={() => onReview(attempt)}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPractice
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
            }`}>
              {isPractice ? t("practiceMode") : t("mockTest")}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              completed ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"
            }`}>
              {completed ? t("completed") : t("inProgress")}
            </span>
          </div>
          <h3 className="mt-3 truncate font-bold text-slate-950">
            {test?.name || attempt.testId}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t("part")} {parts.join(", ")}
          </p>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(attempt);
          }}
          aria-label={`${t("delete")} ${test?.name || attempt.testId}`}
          title={t("delete")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
        >
          <TrashIcon />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <div>
          <p className="font-bold text-emerald-600">{correct}</p>
          <p className="text-[11px] text-slate-500">{t("correct")}</p>
        </div>
        <div>
          <p className="font-bold text-red-500">{wrong}</p>
          <p className="text-[11px] text-slate-500">{t("incorrect")}</p>
        </div>
        <div>
          <p className="font-bold text-slate-500">{completed ? unanswered : attempt.totalQuestions || 0}</p>
          <p className="text-[11px] text-slate-500">{t("unanswered")}</p>
        </div>
      </div>

      <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{date}</span>
        <span aria-hidden="true">•</span>
        <span>{durationMinutes} {t("minuteShort")}</span>
        {completed && result.totalScore != null && (
          <>
            <span aria-hidden="true">•</span>
            <span className="font-bold text-sky-700">{t("score")}: {result.totalScore}</span>
          </>
        )}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onReview(attempt);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
        >
          <EyeIcon /> {t("review")}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onReviewIncorrect(attempt);
          }}
          disabled={completed && !wrong}
          className="rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("reviewIncorrect")}{completed ? ` (${wrong})` : ""}
        </button>
      </div>
    </article>
  );
}

function DeleteConfirmation({ attempt, deleting, error, onCancel, onConfirm }) {
  const { t } = useLanguage();
  if (!attempt) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-5">
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-attempt-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <TrashIcon />
        </span>
        <h2 id="delete-attempt-title" className="mt-5 text-xl font-bold text-slate-950">
          {t("deleteAttemptTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {t("deleteAttemptDescription")}
        </p>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} disabled={deleting} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {t("cancel")}
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:bg-red-300">
            {deleting ? t("deleting") : t("delete")}
          </button>
        </div>
      </section>
    </div>
  );
}

function AttemptHistoryDrawer({ open, attempts, tests, selectedTest, loading, error, onClose, onDelete, onReview, onReviewIncorrect }) {
  const { t } = useLanguage();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !deleteTarget) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleteTarget, onClose, open]);

  if (!open) return null;

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } catch (requestError) {
      setDeleteError(requestError.message || t("historyDeleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 h-full w-full bg-slate-950/45" onClick={onClose} aria-label={t("closeAttemptHistory")} />
      <aside role="dialog" aria-modal="true" aria-labelledby="attempt-history-title" className="absolute inset-y-0 left-0 flex w-full max-w-xl flex-col bg-slate-50 shadow-2xl">
        <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <HistoryIcon />
              </span>
              <div>
                <h2 id="attempt-history-title" className="text-xl font-bold text-slate-950">
                  {t("attemptHistory")}{selectedTest ? ` · ${selectedTest.name}` : ""}
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">{t("historyDescription")}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label={t("closeAttemptHistory")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">×</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && <p className="rounded-2xl bg-white p-6 text-center text-sm text-sky-700">{t("loadingHistory")}</p>}
          {!loading && error && <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p>}
          {!loading && !error && !attempts.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{t("emptyHistory")}</p>}
          {!loading && !error && attempts.length > 0 && (
            <div className="space-y-4">
              {attempts.map((attempt) => (
                <AttemptHistoryCard
                  key={attempt.id}
                  attempt={attempt}
                  test={tests.find((item) => item.id === attempt.testId)}
                  onDelete={setDeleteTarget}
                  onReview={onReview}
                  onReviewIncorrect={onReviewIncorrect}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      <DeleteConfirmation
        attempt={deleteTarget}
        deleting={deleting}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default AttemptHistoryDrawer;
