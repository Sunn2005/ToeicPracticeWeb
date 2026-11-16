import usePageTitle from "../../../components/ui/usePageTitle";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, publicApiFetch } from "../../../api/client";
import TestModeModal from "../components/TestModeModal";
import { ETS_2026_TEST_4, TOEIC_TESTS } from "../data/testCatalog";
import { canContinuePractice, getAttemptParts, getFullMockScoreSummary } from "../../learning-history/utils/attemptHistory";
import { useUserAttempts } from "../../learning-history/hooks/useUserAttempts";
import { useLanguage } from "../../../i18n/LanguageContext";

function practiceScope(attempt, t) {
  if (attempt.mode === "PART") return `${t("part")} ${getAttemptParts(attempt).join(" + ")}`;
  if (attempt.mode === "LISTENING") return t("listening");
  if (attempt.mode === "READING") return t("reading");
  return t("historyFullScope");
}

function isSubmittedMock(attempt) {
  return attempt.status === "COMPLETED" && attempt.type !== "PRACTICE";
}

function TestCatalogCard({ test, attempts, onMode, t }) {
  const active = attempts.find(canContinuePractice);
  const completed = attempts.some(isSubmittedMock);
  const hasHistory = Boolean(active || attempts.some((attempt) => attempt.status === "COMPLETED"));
  const { best } = getFullMockScoreSummary(attempts);
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
          {active ? t("catalogPracticeInProgress") : completed ? t("catalogMockSubmitted") : t("catalogMockNotSubmitted")}
        </span>
      </div>
      {active && completed && <p className="mt-2 text-xs font-medium text-emerald-700">{t("catalogMockSubmitted")}</p>}

      <div className="mt-4 border-t border-slate-100 pt-4">
        {best !== null ? (
          <p className="text-sm text-slate-500">{t("catalogBestScore")}: <strong className="text-emerald-600">{best}/990</strong></p>
        ) : active ? (
          <p className="text-sm text-slate-500">{practiceScope(active, t)} · {t("questionNumber")} {active.currentQuestionNumber || 1}</p>
        ) : <p className="text-sm text-slate-400">{t("chooseModeToStart")}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onMode(test, "exam")} className="flex-1 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">◉ {t("takeExam")}</button>
        <button type="button" onClick={() => onMode(test, "practice", active)} className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">▤ {t("practice")}</button>
        {hasHistory && (
          <Link
            to={{ pathname: "/history", search: new URLSearchParams({ testId: test.id }).toString() }}
            className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {t("catalogHistory")}
          </Link>
        )}
      </div>
    </article>
  );
}

export default function TestCatalogPage() {
  const { t } = useLanguage();
  usePageTitle(t("testCatalogNav"));
  const navigate = useNavigate();
  const { attempts } = useUserAttempts();
  const [tests, setTests] = useState(TOEIC_TESTS);
  const [selectedTest, setSelectedTest] = useState(null);
  const [initialTab, setInitialTab] = useState("exam");
  const [resumePrompt, setResumePrompt] = useState(null);
  const resumeDialogRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  useEffect(() => {
    let active = true;
    publicApiFetch("/api/tests")
      .then((catalog) => {
        if (!active || !Array.isArray(catalog)) return;
        const metadata = new Map(catalog.map((test) => [test.testId, test]));
        const configuredTests = metadata.has(ETS_2026_TEST_4.id)
          ? [...TOEIC_TESTS, ETS_2026_TEST_4]
          : TOEIC_TESTS;
        setTests(configuredTests.map((test) => ({ ...test, ...(metadata.get(test.id) || {}) })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const dialog = resumeDialogRef.current;
    if (resumePrompt && dialog && !dialog.open) dialog.showModal();
  }, [resumePrompt]);

  const openMode = (test, tab, unfinishedPractice) => {
    setSelectedTest(test);
    setInitialTab(tab);
    setError("");
    setResumePrompt(unfinishedPractice ? { attempt: unfinishedPractice } : null);
  };

  const closeResumePrompt = () => {
    if (starting) return;
    setError("");
    if (!resumePrompt.requestBody) setSelectedTest(null);
    setResumePrompt(null);
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
    if (requestBody.type === "PRACTICE" && attempt.resumed) {
      setInitialTab(experience);
      setResumePrompt({ attempt, requestBody });
      return;
    }
    navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } });
  };

  const restart = async () => {
    if (!window.confirm(t("restartAttemptWarning"))) return;
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
    const hasActive = testAttempts.some(canContinuePractice);
    const hasCompleted = testAttempts.some(isSubmittedMock);
    const matchesStatus = status === "ALL"
      || (status === "IN_PROGRESS" && hasActive)
      || (status === "COMPLETED" && hasCompleted)
      || (status === "NOT_STARTED" && !hasCompleted);
    return matchesQuery && matchesStatus;
  }), [attempts, query, status, tests]);

  return (
    <div className="mx-auto max-w-[1380px] space-y-5">
      <p className="text-sm text-slate-600">{t("catalogDescription")}</p>

      <aside className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-800">
        <strong>{t("twoStudyModes")}</strong>
        <div className="mt-2 grid gap-2">
          <span>● <strong>{t("takeExam")}:</strong> {t("mockExamSummary")}</span>
          <span className="text-emerald-700">● <strong>{t("practice")}:</strong> {t("practiceSummary")}</span>
        </div>
      </aside>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-sky-400">
          <span className="text-slate-400">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchTests")} className="w-full bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-sky-400">
          <option value="ALL">{t("statusAll")}</option><option value="NOT_STARTED">{t("catalogMockNotSubmitted")}</option><option value="IN_PROGRESS">{t("catalogPracticeInProgress")}</option><option value="COMPLETED">{t("catalogMockSubmitted")}</option>
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
            t={t}
          />
        ))}
      </section>

      {!filtered.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">{t("noMatchingTests")}</div>}

      {selectedTest && !resumePrompt && <TestModeModal test={selectedTest} initialTab={initialTab} onClose={() => setSelectedTest(null)} onStart={startAttempt} />}

      {resumePrompt && (
        <dialog
          ref={resumeDialogRef}
          aria-labelledby="resume-attempt-title"
          onCancel={(event) => { event.preventDefault(); closeResumePrompt(); }}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
        >
          <h2 id="resume-attempt-title" className="text-xl font-bold">{t("catalogPracticeInProgress")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {selectedTest.title || selectedTest.name} · {practiceScope(resumePrompt.attempt, t)} · {t("questionNumber")} {resumePrompt.attempt.currentQuestionNumber || 1}
          </p>
          {resumePrompt.requestBody && <p className="mt-2 text-sm text-slate-600">{t("restartAttemptWarning")}</p>}
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="mt-6 grid gap-2">
            <button type="button" onClick={() => navigate(`/full-test/${resumePrompt.attempt.id}/exam`, { state: { attempt: resumePrompt.attempt } })} disabled={starting} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{t("catalogContinuePractice")}</button>
            <button type="button" onClick={resumePrompt.requestBody ? restart : () => setResumePrompt(null)} disabled={starting} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{starting ? t("preparing") : t(resumePrompt.requestBody ? "restart" : "catalogNewPractice")}</button>
            <button type="button" onClick={closeResumePrompt} disabled={starting} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{t("cancel")}</button>
          </div>
        </dialog>
      )}
    </div>
  );
}
