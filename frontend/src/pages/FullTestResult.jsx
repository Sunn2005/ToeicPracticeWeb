import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDuration } from "../utils/testData";
import { useLanguage } from "../i18n/LanguageContext";
import { getTestName } from "../data/testCatalog";
import { getAllQuestions } from "../utils/testData";
import { useAuth } from "../auth/useAuth";
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

const PART_NAMES = {
  1: "Photographs",
  2: "Question – Response",
  3: "Conversations",
  4: "Talks",
  5: "Incomplete Sentences",
  6: "Text Completion",
  7: "Reading Comprehension",
};

function Metric({ label, value, tone = "slate", compact = false }) {
  const tones = {
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <p className={`${compact ? "text-lg leading-7" : "text-3xl"} font-bold`}>{value}</p>
      <p className="mt-2 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

function ScoreRing({ label, value, max, tone = "sky", large = false }) {
  const colors = {
    sky: ["#0ea5e9", "#e0f2fe"],
    emerald: ["#10b981", "#d1fae5"],
    violet: ["#8b5cf6", "#ede9fe"],
  };
  const [activeColor, trackColor] = colors[tone];
  const percentage = Math.min(100, Math.max(0, (Number(value) / Math.max(1, Number(max))) * 100));
  return (
    <div
      className={`relative grid shrink-0 place-items-center rounded-full ${large ? "h-36 w-36" : "h-28 w-28"}`}
      style={{ background: `conic-gradient(${activeColor} ${percentage}%, ${trackColor} 0)` }}
    >
      <div className={`grid place-items-center rounded-full bg-white text-center ${large ? "h-28 w-28" : "h-[88px] w-[88px]"}`}>
        <span>
          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
          <strong className={`block text-slate-950 ${large ? "text-3xl" : "text-2xl"}`}>{value}</strong>
        </span>
      </div>
    </div>
  );
}

function PartPerformancePanel({ parts, loading, t }) {
  const listening = parts.filter((part) => part.partNumber <= 4);
  const reading = parts.filter((part) => part.partNumber >= 5);
  const renderSection = (title, items, tone) => (
    <section>
      <h3 className={`border-b border-slate-200 pb-2 text-xs font-bold uppercase tracking-wide ${tone === "emerald" ? "text-emerald-600" : "text-sky-600"}`}>{title}</h3>
      <div className="mt-3 space-y-4">
        {items.map((part) => {
          const color = part.accuracy >= 80 ? "bg-emerald-500" : part.accuracy >= 70 ? "bg-sky-500" : "bg-amber-500";
          return (
            <div key={part.partNumber}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-semibold text-slate-800">Part {part.partNumber}: {part.name}</span>
                <strong className={part.accuracy >= 80 ? "text-emerald-600" : part.accuracy >= 70 ? "text-sky-600" : "text-amber-600"}>{part.accuracy}%</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${part.accuracy}%` }} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-950">{t("partPerformance")}</h2>
      <p className="mt-1 text-sm text-slate-400">{t("partPerformanceDescription")}</p>
      {loading ? (
        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t("loadingPartPerformance")}</p>
      ) : parts.length ? (
        <div className="mt-5 space-y-6">
          {listening.length > 0 && renderSection(t("listeningSection"), listening, "sky")}
          {reading.length > 0 && renderSection(t("readingSection"), reading, "emerald")}
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t("partPerformanceUnavailable")}</p>
      )}
    </section>
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
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm sm:p-7">
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
  const { user, profile } = useAuth();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [reviewData, setReviewData] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [aiAnalysis, setAIAnalysis] = useState(null);
  const [aiError, setAIError] = useState("");
  const [aiRequesting, setAIRequesting] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [retakeError, setRetakeError] = useState("");

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

  useEffect(() => {
    let active = true;
    apiFetch(`/api/attempts/${attemptId}/review`)
      .then((data) => {
        if (active) setReviewData(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReviewLoading(false);
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

  const partPerformance = useMemo(() => {
    if (!reviewData?.test) return [];
    const grouped = new Map();
    getAllQuestions(reviewData.test).forEach(({ partNumber, unit, question }) => {
      const current = grouped.get(partNumber) || {
        partNumber,
        name: PART_NAMES[partNumber] || unit.partName || `Part ${partNumber}`,
        total: 0,
        correct: 0,
      };
      current.total += 1;
      if (question.answerStatus === "CORRECT") current.correct += 1;
      grouped.set(partNumber, current);
    });
    return [...grouped.values()]
      .map((part) => ({
        ...part,
        accuracy: part.total ? Math.round((part.correct / part.total) * 100) : 0,
      }))
      .sort((left, right) => left.partNumber - right.partNumber);
  }, [reviewData]);

  const retakeTest = async () => {
    setRetaking(true);
    setRetakeError("");
    try {
      const durationMinutes = result?.timed && result?.mode === "PART" && result?.timeLimitSeconds
        ? Math.max(1, Math.round(result.timeLimitSeconds / 60))
        : undefined;
      const attempt = await apiFetch(`/api/tests/${result.testId}/attempts`, {
        method: "POST",
        body: JSON.stringify({
          type: result.type,
          mode: result.mode,
          part: result.selectedPart,
          parts: result.selectedParts,
          durationMinutes,
          restartExisting: true,
        }),
      });
      navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } });
    } catch (requestError) {
      setRetakeError(requestError.message || t("unableStartTest"));
      setRetaking(false);
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
  const isPractice = result?.type === "PRACTICE";
  const accuracy = totalQuestions
    ? Math.round(((Number(result?.totalCorrect) || 0) / totalQuestions) * 100)
    : 0;
  const maxScore = resultMode === "FULL" || (listeningTotal > 0 && readingTotal > 0) ? 990 : 495;
  const learnerName = profile?.displayName || user?.displayName || t("learner");
  const targetScore = Number(profile?.targetScore) || 800;
  const pointsToTarget = Math.max(0, targetScore - (Number(result?.totalScore) || 0));
  const completedAt = result?.submittedAt
    ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(result.submittedAt))
    : "—";

  return (
    <div className="text-slate-900">
      <main className="mx-auto max-w-[1380px] space-y-6">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        ) : (
          <>
            <section className="flex flex-col justify-between gap-6 rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-sm sm:px-8 lg:flex-row lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">{t("completed")}</span>
                  <span>{t("completedAt")}: {completedAt}</span>
                </div>
                <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{t("congratulations")} {learnerName}! 🎉</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{t("resultIntroPrefix")} <strong>{testName} · {modeTitle}</strong> {t("resultIntroSuffix")}</p>
              </div>
              <button type="button" onClick={() => navigate("/tests")} className="shrink-0 rounded-xl border border-sky-500 px-6 py-3 font-semibold text-sky-600 transition hover:bg-sky-50">{t("backToTestList")}</button>
            </section>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                  <h2 className="text-xl font-bold text-slate-950">{t("overallScore")}</h2>
                  <div className="mt-6 flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col items-center gap-5 rounded-2xl bg-sky-50/70 p-5 sm:flex-row sm:px-7">
                      <ScoreRing
                        label={isPractice ? t("accuracy") : t("totalScore")}
                        value={isPractice ? accuracy : Number(result.totalScore) || 0}
                        max={isPractice ? 100 : maxScore}
                        large
                      />
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-slate-500">{t("yourTarget")}:</p>
                        <strong className="mt-1 block text-2xl text-sky-600">{isPractice ? "100%" : `${targetScore} / 990`}</strong>
                        {!isPractice && <p className="mt-1 text-sm text-slate-400">{pointsToTarget} {t("pointsToTarget")}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-7 lg:justify-end">
                      {listeningTotal > 0 && (
                        <ScoreRing
                          label={t("listening")}
                          value={isPractice ? Math.round(((Number(result.listeningCorrect) || 0) / listeningTotal) * 100) : Number(result.listeningScore) || 0}
                          max={isPractice ? 100 : 495}
                          tone="sky"
                        />
                      )}
                      {readingTotal > 0 && (
                        <ScoreRing
                          label={t("reading")}
                          value={isPractice ? Math.round(((Number(result.readingCorrect) || 0) / readingTotal) * 100) : Number(result.readingScore) || 0}
                          max={isPractice ? 100 : 495}
                          tone="emerald"
                        />
                      )}
                    </div>
                  </div>

                  <div className="my-6 h-px bg-slate-100" />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label={t("correctCountLabel")} value={`${result.totalCorrect}/${totalQuestions}`} tone="emerald" />
                    <Metric label={t("wrongCountLabel")} value={`${result.totalWrong}/${totalQuestions}`} />
                    <Metric label={t("blankCountLabel")} value={`${result.totalUnanswered}/${totalQuestions}`} tone="violet" />
                    <Metric label={t("timeTaken")} value={formatDuration(result.durationSeconds, language)} tone="sky" compact />
                  </div>
                  {!isPractice && <p className="mt-5 text-xs leading-5 text-slate-400">{t("estimatedScoreNote")}</p>}
                </section>

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
              </div>

              <aside className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-bold text-slate-950">{t("nextActionsTitle")}</h2>
                  <div className="mt-5 space-y-3">
                    <button type="button" onClick={() => navigate(`/full-test/${attemptId}/review`)} className="w-full rounded-xl bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600">{t("viewDetailedAnswers")}</button>
                    <button type="button" onClick={retakeTest} disabled={retaking} className="w-full rounded-xl border border-sky-500 px-5 py-3 font-semibold text-sky-600 transition hover:bg-sky-50 disabled:opacity-60">{retaking ? t("retaking") : t("retakeThisTest")}</button>
                    <button type="button" onClick={() => navigate("/tests")} className="w-full px-5 py-3 text-sm font-semibold text-slate-600 transition hover:text-sky-600">{t("backToTestList")}</button>
                  </div>
                  {retakeError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{retakeError}</p>}
                </section>

                <PartPerformancePanel parts={partPerformance} loading={reviewLoading} t={t} />
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default FullTestResult;
