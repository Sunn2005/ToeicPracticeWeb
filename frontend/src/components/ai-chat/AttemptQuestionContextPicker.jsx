import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

function formatAttemptDate(value, language) {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return "";
  const locale = language === "vi" ? "vi-VN" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(time));
}

function practicePartLabel(attempt) {
  if (attempt.type !== "PRACTICE") return "";
  if (Number.isInteger(attempt.selectedPart)) return `Part ${attempt.selectedPart}`;
  const parts = Array.isArray(attempt.selectedParts)
    ? attempt.selectedParts.filter(Number.isInteger)
    : [];
  return parts.length ? `Part ${parts.join(", ")}` : "";
}

function attemptLabel(attempt, language, t) {
  const segments = [attempt.title];
  const part = practicePartLabel(attempt);
  if (part) segments.push(part);
  const score = Number(attempt.score);
  if (Number.isFinite(score)) segments.push(`${t("score")}: ${score}`);
  const date = formatAttemptDate(attempt.submittedAt, language);
  if (date) segments.push(date);
  return segments.join(" · ");
}

export default function AttemptQuestionContextPicker({
  attempts,
  getQuestionChoices,
  onCreate,
  onSuggestedPrompt,
  creating,
  disabled = false,
}) {
  const { t, language } = useLanguage();
  const [attemptId, setAttemptId] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState("");
  const suggestions = [
    t("chatSuggestionPresentPerfect"),
    t("chatSuggestionPart5"),
    t("chatSuggestionArticles"),
  ];
  const completedAttempts = attempts.filter(({ status }) => status === "COMPLETED");

  useEffect(() => {
    if (!attemptId) return undefined;
    const controller = new AbortController();
    getQuestionChoices(attemptId, { signal: controller.signal })
      .then((choices) => setQuestions(choices))
      .catch((requestError) => {
        if (requestError?.name !== "AbortError") {
          setError(requestError?.message || t("chatQuestionLoadError"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingQuestions(false);
      });
    return () => controller.abort();
  }, [attemptId, getQuestionChoices, t]);

  return (
    <div className="flex flex-1 justify-center overflow-y-auto px-5 py-7 min-[680px]:px-8 min-[680px]:py-9">
      <div className="w-full max-w-4xl">
        <h3 className="text-2xl font-bold text-slate-950 min-[680px]:text-3xl">{t("chatNewConversation")}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 min-[680px]:text-base">{t("chatContextDescription")}</p>

        <div className="mt-5 flex flex-wrap gap-2" aria-label={t("chatSuggestionsLabel")}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestedPrompt(suggestion)}
              disabled={creating || disabled}
              className="min-h-11 rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onCreate()}
          disabled={creating || disabled}
          className="mt-5 min-h-12 w-full rounded-xl bg-sky-600 px-4 py-3 text-base font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-sky-300"
        >
          {t("chatStartGeneral")}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>{t("or")}</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg font-bold text-slate-900">{t("chatAskAboutQuestion")}</legend>
          <div>
            <label htmlFor="capy-chat-attempt" className="mb-1.5 block text-sm font-semibold text-slate-700">{t("chatCompletedAttempt")}</label>
            <select
              id="capy-chat-attempt"
              value={attemptId}
              disabled={disabled}
              onChange={(event) => {
                const nextAttemptId = event.target.value;
                setAttemptId(nextAttemptId);
                setQuestionNumber("");
                setQuestions([]);
                setError("");
                setLoadingQuestions(Boolean(nextAttemptId));
              }}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            >
              <option value="">{t("chatSelectAttempt")}</option>
              {attempts.map((attempt) => (
                <option
                  key={attempt.id}
                  value={attempt.id}
                  disabled={attempt.status !== "COMPLETED"}
                >
                  {attemptLabel(attempt, language, t)}{attempt.status !== "COMPLETED" ? ` — ${t("chatAttemptInProgressOption")}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="capy-chat-question" className="mb-1.5 block text-sm font-semibold text-slate-700">{t("question")}</label>
            <select
              id="capy-chat-question"
              value={questionNumber}
              onChange={(event) => setQuestionNumber(event.target.value)}
              disabled={disabled || !attemptId || loadingQuestions}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                {loadingQuestions ? t("loading") : attemptId ? t("chatSelectQuestion") : t("chatSelectAttemptFirst")}
              </option>
              {questions.map((number) => <option key={number} value={number}>{t("question")} {number}</option>)}
            </select>
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!completedAttempts.length && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-500">{t("chatNoCompletedAttempts")}</p>}
          <button
            type="button"
            onClick={() => onCreate({ attemptId, questionNumber: Number(questionNumber) })}
            disabled={creating || disabled || !attemptId || !questionNumber}
            className="min-h-12 w-full rounded-xl bg-sky-600 px-4 py-3 text-base font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {t("chatStartWithQuestion")}
          </button>
          <p className="text-center text-sm leading-6 text-slate-500">{t("chatQuestionSelectionHint")}</p>
        </fieldset>
      </div>
    </div>
  );
}
