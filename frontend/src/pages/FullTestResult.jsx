import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDuration } from "../utils/testData";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import { getTestName } from "../data/testCatalog";
import {
  getAttemptAIAnalysis,
  requestAttemptAIAnalysis,
} from "../api/aiAnalysis";
import {
  canRequestAIAnalysis,
  getAIAnalysisErrorKey,
  selectAIAnalysisResult,
  shouldPollAIAnalysis,
} from "../utils/aiAnalysis";

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

function formatConfidence(value, t) {
  const labels = {
    HIGH: t("confidenceHigh"),
    MEDIUM: t("confidenceMedium"),
    LOW: t("confidenceLow"),
  };
  return labels[value] || value;
}

function InsightList({ items, emptyText, t }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <article key={`${item.tag || item.title}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">{item.title}</h3>
            {item.tag && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.tag}</span>}
            {item.confidence && <span className="text-xs font-semibold text-slate-500">{formatConfidence(item.confidence, t)}</span>}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.message || item.explanation || item.reason}</p>
          {item.recommendation && <p className="mt-2 text-sm font-medium text-sky-700">{item.recommendation}</p>}
          {item.goal && <p className="mt-2 text-sm font-medium text-violet-700"><strong>{t("learningGoal")}:</strong> {item.goal}</p>}
          {item.topicsToReview?.length > 0 && (
            <p className="mt-2 text-sm text-slate-600">
              <strong>{t("topicsToReview")}:</strong> {item.topicsToReview.join(" · ")}
            </p>
          )}
          {item.evidence && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              {t("evidenceLabel")}: {item.evidence.correct}/{item.evidence.total} {t("questionsCorrect")}
              {Number.isFinite(Number(item.evidence.accuracy)) ? ` · ${item.evidence.accuracy}%` : ""}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function AIAnalysisPanel({ analysis, status, busy, error, onRequest, language, t }) {
  const storedResult = analysis?.result;
  const result = selectAIAnalysisResult(storedResult, language);
  const summary = result?.summary;
  const statistics = result?.statistics;

  return (
    <section className="mt-8 rounded-3xl border border-violet-200 bg-violet-50/60 p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">AI TOEIC Coach</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{t("aiAnalysisOverview")}</h2>
        </div>
        {(status === "NOT_REQUESTED" || status === "FAILED" || status === "COMPLETED") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRequest(status === "COMPLETED")}
            className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? t("aiAnalysisProcessing")
              : status === "FAILED"
                ? t("retryAIAnalysis")
                : status === "COMPLETED"
                  ? t("refreshAIAnalysis")
                  : t("requestAIAnalysis")}
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {status === "PENDING" && <p className="mt-5 rounded-xl bg-white p-4 text-sm text-violet-700">{t("aiAnalysisPending")}</p>}
      {status === "PROCESSING" && <p className="mt-5 rounded-xl bg-white p-4 text-sm text-violet-700">{t("aiAnalysisProcessing")}</p>}
      {status === "FAILED" && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p>{t(getAIAnalysisErrorKey(analysis?.errorCode))}</p>
          {analysis?.errorCode && (
            <p className="mt-2 font-mono text-xs text-red-500">{analysis.errorCode}</p>
          )}
        </div>
      )}

      {status === "COMPLETED" && result && (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-xl font-bold text-slate-950">{summary?.headline}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{summary?.overallComment}</p>
            {statistics && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric label={t("listening")} value={statistics.listeningScore} tone="sky" />
                <Metric label={t("reading")} value={statistics.readingScore} tone="violet" />
                <Metric label={t("totalScore")} value={statistics.totalScore} tone="emerald" />
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <h3 className="mb-3 text-lg font-bold text-emerald-800">{t("strengths")}</h3>
              <InsightList items={result.strengths} emptyText={t("noReliableConclusion")} t={t} />
            </section>
            <section>
              <h3 className="mb-3 text-lg font-bold text-rose-800">{t("weaknesses")}</h3>
              <InsightList items={result.weaknesses} emptyText={t("noReliableConclusion")} t={t} />
            </section>
          </div>

          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t("partAnalysis")}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(result.partAnalysis || []).map((part) => (
                <article key={part.part} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <strong>Part {part.part}</strong>
                    <span className="text-sm font-bold text-violet-700">{part.accuracy}%</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{part.summary}</p>
                  {part.strongTags?.length > 0 && (
                    <p className="mt-3 text-xs leading-5 text-emerald-700">
                      <strong>{t("strongSkills")}:</strong> {part.strongTags.join(" · ")}
                    </p>
                  )}
                  {part.weakTags?.length > 0 && (
                    <p className="mt-1 text-xs leading-5 text-rose-700">
                      <strong>{t("skillsToImprove")}:</strong> {part.weakTags.join(" · ")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t("knowledgeGaps")}</h3>
            <InsightList items={result.knowledgeGaps} emptyText={t("noKnowledgeGaps")} t={t} />
          </section>

          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t("priorityTopics")}</h3>
            <InsightList items={(result.priorityTopics || []).slice(0, 3)} emptyText={t("noPriorityTopics")} t={t} />
          </section>

          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t("studyPlan")}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {(result.studyPlan || []).map((day) => (
                <article key={day.day} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-600">{t("day")} {day.day} · {day.estimatedMinutes} {t("minuteShort")}</p>
                  <h4 className="mt-1 font-bold">{day.title}</h4>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {(day.tasks || []).map((task, index) => <li key={index}>• {task.title} ({task.durationMinutes} {t("minuteShort")})</li>)}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 text-lg font-bold text-slate-900">{t("nextActions")}</h3>
              <div className="flex flex-wrap gap-2">
                {(result.nextActions || []).map((action, index) => (
                  <span key={index} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-200">{action.label}</span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-lg font-bold text-slate-900">{t("confidenceAndLimits")}</h3>
              <p className="text-sm font-semibold text-slate-700">{formatConfidence(result.overallConfidence, t)}</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {(result.limitations || []).map((item, index) => <li key={index}>• {item}</li>)}
              </ul>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function FullTestResult() {
  const { language, t } = useLanguage();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [aiAnalysis, setAIAnalysis] = useState(null);
  const [aiError, setAIError] = useState("");
  const [aiRequesting, setAIRequesting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/attempts/${attemptId}/result`)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [attemptId]);

  const aiEligible = canRequestAIAnalysis(result);
  const aiStatus = aiAnalysis?.status || aiAnalysis?.aiAnalysisStatus || "NOT_REQUESTED";

  useEffect(() => {
    if (!aiEligible) return undefined;
    let active = true;
    getAttemptAIAnalysis(attemptId)
      .then((data) => {
        if (active) setAIAnalysis(data);
      })
      .catch((requestError) => {
        if (active) setAIError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [aiEligible, attemptId]);

  useEffect(() => {
    if (!aiEligible || !shouldPollAIAnalysis(aiStatus)) return undefined;
    let active = true;
    const timeoutId = window.setTimeout(() => {
      getAttemptAIAnalysis(attemptId)
        .then((data) => {
          if (active) setAIAnalysis(data);
        })
        .catch((requestError) => {
          if (active) setAIError(requestError.message);
        });
    }, 2_000);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [aiEligible, aiStatus, attemptId, aiAnalysis]);

  const requestAIAnalysis = async (refresh = false) => {
    setAIRequesting(true);
    setAIError("");
    try {
      const data = await requestAttemptAIAnalysis(attemptId, { refresh });
      setAIAnalysis(data);
    } catch (requestError) {
      setAIError(requestError.message);
    } finally {
      setAIRequesting(false);
    }
  };

  if (!result && !error) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">{t("scoringTest")}</div>;
  }

  const resultMode = result?.mode || "FULL";
  const listeningTotal = result?.listeningTotalQuestions
    ?? (resultMode === "READING" ? 0 : 100);
  const readingTotal = result?.readingTotalQuestions
    ?? (resultMode === "LISTENING" ? 0 : 100);
  const totalQuestions = result?.totalQuestions || listeningTotal + readingTotal;
  const selectedParts = result?.selectedParts?.length
    ? result.selectedParts
    : result?.selectedPart
      ? [result.selectedPart]
      : [];
  const testName = getTestName(result?.testId);
  const resultModeTitle = resultMode === "FULL"
    ? t("fullTest")
    : resultMode === "LISTENING"
      ? t("listeningTest")
      : resultMode === "READING"
        ? t("readingTest")
        : `${t("part")} ${selectedParts.join(" + ")}`;
  const modeTitle = result?.type === "PRACTICE"
    ? `${t("practiceMode")} · ${resultModeTitle}`
    : resultModeTitle;
  const maxScore = resultMode === "FULL" || (listeningTotal > 0 && readingTotal > 0) ? 990 : 495;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50 to-cyan-100 px-5 py-8 text-slate-900 sm:px-8 sm:py-12">
      <main className="mx-auto max-w-5xl">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-4xl bg-white shadow-2xl shadow-sky-100">
              <div className="bg-slate-950 px-6 py-8 text-white sm:px-10">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">{testName} · {modeTitle} · {t("testResults")}</p>
                <div className="mt-4 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                  <div>
                    <h1 className="text-3xl font-bold sm:text-4xl">{t("completedTest")}</h1>
                    <p className="mt-3 text-slate-300">
                      {t("testDurationLabel")} {formatDuration(result.durationSeconds)}
                      {result.autoSubmitted ? ` · ${t("autoSubmitted")}` : ""}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/10 px-8 py-5 text-center ring-1 ring-white/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-sky-300">{t("estimatedScore")}</p>
                    <p className="mt-1 text-5xl font-black">{result.totalScore}</p>
                    <p className="text-sm text-slate-300">/ {maxScore}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-10">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {listeningTotal > 0 && (
                    <Metric label={t("listening")} value={`${result.listeningScore}/495`} tone="sky" />
                  )}
                  {readingTotal > 0 && (
                    <Metric label={t("reading")} value={`${result.readingScore}/495`} tone="violet" />
                  )}
                  <Metric label={t("correct")} value={`${result.totalCorrect}/${totalQuestions}`} tone="emerald" />
                  <Metric label={t("incorrect")} value={result.totalWrong} />
                  <Metric label={t("unanswered")} value={result.totalUnanswered} />
                </div>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  {listeningTotal > 0 && <section className="rounded-2xl border border-slate-200 p-5">
                    <h2 className="font-bold">{t("listening")}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {t("correct")} {result.listeningCorrect}/{listeningTotal} · {t("incorrect")} {result.listeningWrong} · {t("unanswered")} {result.listeningUnanswered}
                    </p>
                  </section>}
                  {readingTotal > 0 && <section className="rounded-2xl border border-slate-200 p-5">
                    <h2 className="font-bold">{t("reading")}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {t("correct")} {result.readingCorrect}/{readingTotal} · {t("incorrect")} {result.readingWrong} · {t("unanswered")} {result.readingUnanswered}
                    </p>
                  </section>}
                </div>

                <p className="mt-7 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  {t("estimatedScoreNote")}
                </p>

                {aiEligible && (
                  <AIAnalysisPanel
                    analysis={aiAnalysis}
                    status={aiStatus}
                    busy={aiRequesting}
                    error={aiError}
                    onRequest={requestAIAnalysis}
                    language={language}
                    t={t}
                  />
                )}

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t("backToTestList")}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/full-test/${attemptId}/review`)}
                    className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white shadow-lg shadow-sky-200 hover:bg-sky-600"
                  >
                    {t("reviewAnswers")}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default FullTestResult;
