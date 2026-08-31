import { useLanguage } from "../i18n/LanguageContext";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}

function TestCard({ test, attempts = [], onSelect, onOpenHistory }) {
  const { t } = useLanguage();
  const latestCompleted = attempts.find((attempt) => attempt.status === "COMPLETED");
  const result = latestCompleted?.result;
  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-linear-to-br from-white to-sky-50/70 p-6 shadow-sm transition duration-200 sm:p-7 ${
        test.available
          ? "border-sky-100 hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100"
          : "border-slate-200 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-lg font-black text-white shadow-lg shadow-sky-200">
          {test.name.replace("Test ", "T")}
        </span>
        <div className="flex items-center gap-2">
          {test.available && (
            <button
              type="button"
              onClick={() => onOpenHistory(test)}
              aria-label={`${t("attemptHistory")} · ${test.name}`}
              title={t("attemptHistory")}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-sky-600 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-100"
            >
              <HistoryIcon />
              {attempts.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-black text-white">
                  {attempts.length > 99 ? "99+" : attempts.length}
                </span>
              )}
            </button>
          )}
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              test.available
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {test.available ? t("ready") : t("comingSoon")}
          </span>
        </div>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-sky-600">
        {test.name}
      </p>
      <h4 className="mt-2 text-xl font-bold leading-7 text-slate-950">
        {test.title}
      </h4>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
          {test.totalQuestions} {t("questions")}
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
          {test.duration} {t("minuteShort")}
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
          Part 1–7
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-slate-500">{attempts.length} {t("attempts")}</span>
        {result ? (
          <span className="font-bold text-emerald-600">
            {t("lastResult")}: {result.totalCorrect || 0}/{result.totalQuestions || test.totalQuestions}
          </span>
        ) : (
          <span className="text-slate-400">{t("noPreviousAttempt")}</span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onSelect(test, "exam")}
          disabled={!test.available}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <PlayIcon /> {test.available ? t("mockExam") : t("comingSoon")}
        </button>
        <button
          type="button"
          onClick={() => onSelect(test, "practice")}
          disabled={!test.available}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <BookIcon /> {test.available ? t("practiceMode") : t("comingSoon")}
        </button>
      </div>
    </article>
  );
}

export default TestCard;
