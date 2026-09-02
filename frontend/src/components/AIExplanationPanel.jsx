import { useLanguage } from "../i18n/LanguageContext";

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z" />
      <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      <path d="m5 13 .7 1.8 1.8.7-1.8.7L5 18l-.7-1.8-1.8-.7 1.8-.7L5 13Z" />
    </svg>
  );
}

function LoadingIndicator({ label }) {
  return (
    <div role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-indigo-700">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function AIExplanationPanel({ feedback, onRequest }) {
  const { t } = useLanguage();
  const status = feedback?.status || "IDLE";
  const result = feedback?.result;
  const isPending = status === "PENDING";
  const buttonLabel = status === "SUCCEEDED"
    ? t("requestAiFeedbackAgain")
    : status === "FAILED"
      ? t("retryAiFeedback")
      : t("requestAiFeedback");

  return (
    <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <SparklesIcon />
          </span>
          <div>
            <h4 className="text-sm font-bold text-indigo-950">{t("aiFeedbackTitle")}</h4>
            {status === "IDLE" && (
              <p className="mt-1 text-xs leading-5 text-indigo-700">{t("aiFeedbackDescription")}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onRequest}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-300"
        >
          {buttonLabel}
        </button>
      </div>

      {isPending && <LoadingIndicator label={t("aiFeedbackLoading")} />}

      {status === "FAILED" && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-white/80 px-3 py-2 text-sm leading-6 text-red-700">
          {feedback.error || t("aiFeedbackError")}
        </p>
      )}

      {status === "SUCCEEDED" && result && (
        <div aria-live="polite" className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
          <p className="whitespace-pre-line">{result.explanation}</p>
          {result.grammarPoint && (
            <p className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2">
              <strong className="text-indigo-900">{t("aiGrammarPoint")}</strong>{" "}
              <span className="whitespace-pre-line">{result.grammarPoint}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default AIExplanationPanel;
