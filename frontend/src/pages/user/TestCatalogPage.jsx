import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, publicApiFetch } from "../../api/client";
import TestModeModal from "../../components/TestModeModal";
import { TOEIC_TESTS } from "../../data/testCatalog";
import { useUserAttempts } from "../../hooks/useUserAttempts";
import { useLanguage } from "../../i18n/LanguageContext";

function TestCatalogCard({ test, attempts, onMode, onContinue, onResult, onReview, t }) {
  const active = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
  const latest = attempts.find((attempt) => attempt.status === "COMPLETED" && attempt.type !== "PRACTICE");
  const completed = Boolean(latest);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-sky-50 px-2 py-1 font-semibold text-sky-600">{t("fullTest")}</span>
            <span className="text-slate-400">{test.totalQuestions} {t("questions")} · {test.duration} {t("minutes")}</span>
          </div>
          <h3 className="mt-2 font-bold text-slate-950">{test.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-amber-50 text-amber-700" : completed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {active ? t("inProgress") : completed ? t("completed") : t("notStarted")}
        </span>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {latest ? (
          <p className="text-sm text-slate-500">{t("latestScore")}: <strong className="text-emerald-600">{latest.result?.totalScore || 0}/990</strong></p>
        ) : active ? (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500"><span>{t("progressLabel")}</span><strong className="text-sky-600">{t("questionNumber")} {active.currentQuestionNumber || 1}</strong></div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, ((active.currentQuestionNumber || 1) / 200) * 100)}%` }} /></div>
          </div>
        ) : <p className="text-sm text-slate-400">{t("chooseModeToStart")}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {active ? (
          <button type="button" onClick={() => onContinue(active)} className="flex-1 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">▶ {t("continue")}</button>
        ) : (
          <>
            <button type="button" onClick={() => onMode(test, "exam")} className="flex-1 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">◉ {t("takeExam")}</button>
            <button type="button" onClick={() => onMode(test, "practice")} className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">▤ {t("practice")}</button>
          </>
        )}
        {latest && (
          <>
            <button type="button" onClick={() => onResult(latest)} className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">{t("viewResults")}</button>
            <button type="button" onClick={() => onReview(latest)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-sky-600 hover:bg-sky-50">{t("reviewAnswers")}</button>
          </>
        )}
      </div>
    </article>
  );
}

export default function TestCatalogPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { attempts } = useUserAttempts();
  const [tests, setTests] = useState(TOEIC_TESTS);
  const [selectedTest, setSelectedTest] = useState(null);
  const [initialTab, setInitialTab] = useState("exam");
  const [resumePrompt, setResumePrompt] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    let active = true;
    publicApiFetch("/api/tests")
      .then((catalog) => {
        if (!active || !Array.isArray(catalog)) return;
        const metadata = new Map(catalog.map((test) => [test.testId, test]));
        setTests(TOEIC_TESTS.map((test) => ({ ...test, ...(metadata.get(test.id) || {}) })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const openMode = (test, tab) => {
    setSelectedTest(test);
    setInitialTab(tab);
    setError("");
  };

  const startAttempt = async ({ mode, part, parts, durationMinutes, experience }) => {
    const requestBody = {
      type: experience === "practice" ? "PRACTICE" : "FULL_TEST",
      mode,
      part,
      parts,
      durationMinutes,
    };
    const attempt = await apiFetch(`/api/tests/${selectedTest.id}/attempts`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    if (attempt.resumed) {
      setResumePrompt({ attempt, requestBody });
      return;
    }
    navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } });
  };

  const restart = async () => {
    setStarting(true);
    setError("");
    try {
      const attempt = await apiFetch(`/api/tests/${selectedTest.id}/attempts`, {
        method: "POST",
        body: JSON.stringify({ ...resumePrompt.requestBody, restartExisting: true }),
      });
      navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } });
    } catch (requestError) {
      setError(requestError.message || t("restartFailed"));
      setStarting(false);
    }
  };

  const filtered = useMemo(() => tests.filter((test) => {
    const testAttempts = attempts.filter((attempt) => attempt.testId === test.id);
    const matchesQuery = `${test.name} ${test.title}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = ["ALL", "FULL", "LISTENING", "READING"].includes(category);
    const hasActive = testAttempts.some((attempt) => attempt.status === "IN_PROGRESS");
    const hasCompleted = testAttempts.some((attempt) => attempt.status === "COMPLETED");
    const matchesStatus = status === "ALL"
      || (status === "IN_PROGRESS" && hasActive)
      || (status === "COMPLETED" && hasCompleted)
      || (status === "NOT_STARTED" && !hasActive && !hasCompleted);
    return matchesQuery && matchesCategory && matchesStatus;
  }), [attempts, category, query, status, tests]);

  return (
    <div className="mx-auto max-w-[1380px] space-y-5">
      <section>
        <h2 className="text-2xl font-bold">{t("testSets")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("catalogDescription")}</p>
      </section>

      <aside className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-800">
        <strong>{t("twoStudyModes")}</strong>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <span>● <strong>{t("takeExam")}:</strong> {t("mockExamSummary")}</span>
          <span className="text-emerald-700">● <strong>{t("practice")}:</strong> {t("practiceSummary")}</span>
        </div>
      </aside>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-sky-400">
          <span className="text-slate-400">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchTests")} className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <div className="flex overflow-x-auto rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {[["ALL",t("all")],["FULL",t("fullTest")],["LISTENING",t("listening")],["READING",t("reading")]].map(([value, label]) => <button key={value} type="button" onClick={() => setCategory(value)} className={`whitespace-nowrap rounded-md px-4 py-2 ${category === value ? "bg-white text-sky-600 shadow-sm" : "text-slate-600"}`}>{label}</button>)}
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-400">
          <option value="ALL">{t("statusAll")}</option><option value="NOT_STARTED">{t("notStarted")}</option><option value="IN_PROGRESS">{t("inProgress")}</option><option value="COMPLETED">{t("completed")}</option>
        </select>
      </section>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-5 lg:grid-cols-2">
        {filtered.map((test) => (
          <TestCatalogCard
            key={test.id}
            test={test}
            attempts={attempts.filter((attempt) => attempt.testId === test.id)}
            onMode={openMode}
            onContinue={(attempt) => navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } })}
            onResult={(attempt) => navigate(`/full-test/${attempt.id}/result`)}
            onReview={(attempt) => navigate(`/full-test/${attempt.id}/review`)}
            t={t}
          />
        ))}
      </section>

      {!filtered.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">{t("noMatchingTests")}</div>}

      {selectedTest && !resumePrompt && <TestModeModal test={selectedTest} initialTab={initialTab} onClose={() => setSelectedTest(null)} onStart={startAttempt} />}

      {resumePrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{t("unfinishedAttemptFound")}</span>
            <h2 className="mt-4 text-xl font-bold">{t("resumeOrRestartSimple")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t("savedAnswersRemain")}</p>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={restart} disabled={starting} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold">{starting ? t("preparing") : t("restart")}</button>
              <button type="button" onClick={() => navigate(`/full-test/${resumePrompt.attempt.id}/exam`, { state: { attempt: resumePrompt.attempt } })} disabled={starting} className="flex-1 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white">{t("continue")}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
