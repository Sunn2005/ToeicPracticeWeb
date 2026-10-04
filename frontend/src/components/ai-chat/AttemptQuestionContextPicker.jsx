import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function AttemptQuestionContextPicker({
  attempts,
  getQuestionChoices,
  onCreate,
  creating,
}) {
  const { t } = useLanguage();
  const [attemptId, setAttemptId] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState("");

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
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-8">
      <div className="w-full max-w-md">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-2xl" aria-hidden="true">🦫</span>
        <h3 className="mt-4 text-lg font-bold text-slate-950">{t("chatNewConversation")}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("chatContextDescription")}</p>

        <button
          type="button"
          onClick={() => onCreate()}
          disabled={creating}
          className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:bg-sky-300"
        >
          {t("chatStartGeneral")}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>{t("or")}</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-bold text-slate-800">{t("chatAskAboutQuestion")}</legend>
          <div>
            <label htmlFor="capy-chat-attempt" className="mb-1.5 block text-sm font-semibold text-slate-700">{t("chatCompletedAttempt")}</label>
            <select
              id="capy-chat-attempt"
              value={attemptId}
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
                <option key={attempt.id} value={attempt.id}>{attempt.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="capy-chat-question" className="mb-1.5 block text-sm font-semibold text-slate-700">{t("question")}</label>
            <select
              id="capy-chat-question"
              value={questionNumber}
              onChange={(event) => setQuestionNumber(event.target.value)}
              disabled={!attemptId || loadingQuestions}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">{loadingQuestions ? t("loading") : t("chatSelectQuestion")}</option>
              {questions.map((number) => <option key={number} value={number}>{t("question")} {number}</option>)}
            </select>
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!attempts.length && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-500">{t("chatNoCompletedAttempts")}</p>}
          <button
            type="button"
            onClick={() => onCreate({ attemptId, questionNumber: Number(questionNumber) })}
            disabled={creating || !attemptId || !questionNumber}
            className="w-full rounded-xl border border-sky-300 px-4 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
          >
            {t("chatStartWithQuestion")}
          </button>
        </fieldset>
      </div>
    </div>
  );
}
