import { formatClock } from "../../exam/utils/testData";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserAttempts } from "../hooks/useUserAttempts";
import { canContinuePractice, getAttemptParts, getAttemptScoreMaximum, getFullMockScoreSummary } from "../utils/attemptHistory";
import { getTestName } from "../../test-catalog/data/testCatalog";
import { useLanguage } from "../../../i18n/LanguageContext";

const PAGE_SIZE = 8;
const HISTORY_REFERENCE_TIME = Date.now();

function formatDate(timestamp, language) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp));
}

function attemptLabel(attempt, t) {
  if (attempt.mode === "FULL") return t("historyFullScope");
  if (attempt.mode === "LISTENING") return t("listening");
  if (attempt.mode === "READING") return t("reading");
  return `${t("part")} ${getAttemptParts(attempt).join(", ")}`;
}

function attemptResultLabel(attempt, t) {
  if (attempt.status !== "COMPLETED" || !attempt.result) return "—";
  const { totalCorrect, totalQuestions, totalScore } = attempt.result;
  if (attempt.type === "PRACTICE" || attempt.mode === "PART") {
    if (!Number.isFinite(totalCorrect) || !(totalQuestions > 0)) return "—";
    return t("historyCorrectAnswers").replace("{count}", `${totalCorrect}/${totalQuestions}`);
  }
  if (!Number.isFinite(totalScore)) return "—";
  return t("historyEstimatedPoints").replace("{score}", `${totalScore}/${getAttemptScoreMaximum(attempt)}`);
}

function attemptTimeLimitLabel(attempt, t) {
  if (attempt.timed === false) return t("unlimited");
  const seconds = attempt.timeLimitSeconds ?? attempt.result?.timeLimitSeconds;
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  return `${Math.ceil(seconds / 60)} ${t("minutes")}`;
}

function SummaryCard({ icon, value, label, tone = "sky" }) {
  const tones = { sky: "bg-sky-50 text-sky-500", emerald: "bg-emerald-50 text-emerald-500", violet: "bg-violet-50 text-violet-500", amber: "bg-amber-50 text-amber-500" };
  return <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${tones[tone]}`}>{icon}</span><span><strong className="block text-2xl font-bold">{value}</strong><span className="text-sm text-slate-500">{label}</span></span></article>;
}

export default function AttemptHistoryPage() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const testId = searchParams.get("testId");
  const { attempts, loading, error, remove } = useUserAttempts();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [requestedPage, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const scopedAttempts = useMemo(
    () => testId ? attempts.filter((attempt) => attempt.testId === testId) : attempts,
    [attempts, testId],
  );
  const { best, average } = getFullMockScoreSummary(scopedAttempts);
  const latest = scopedAttempts.reduce(
    (max, attempt) => Math.max(max, attempt.updatedAt || attempt.submittedAt || attempt.startedAt || 0),
    0,
  );

  const filtered = useMemo(() => {
    const days = period === "7" ? 7 : period === "30" ? 30 : null;
    return scopedAttempts.filter((attempt) => {
      if (attempt.status !== "COMPLETED" && !canContinuePractice(attempt)) return false;
      const text = `${getTestName(attempt.testId)} ${attemptLabel(attempt, t)}`.toLowerCase();
      const timestamp = Number(attempt.submittedAt || attempt.updatedAt || attempt.startedAt) || 0;
      return text.includes(query.trim().toLowerCase())
        && (!days || HISTORY_REFERENCE_TIME - timestamp <= days * 86_400_000)
        && (type === "ALL" || attempt.type === type)
        && (status === "ALL" || attempt.status === status);
    });
  }, [scopedAttempts, period, query, status, t, type]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1380px] space-y-6">
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {testId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
          <span className="font-semibold text-sky-900">{getTestName(testId)}</span>
          <button
            type="button"
            onClick={() => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete("testId");
              setSearchParams(nextParams);
              setPage(1);
            }}
            className="font-semibold text-sky-700 hover:underline"
          >
            {t("historyShowAllTests")}
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon="▦" value={scopedAttempts.length} label={t("totalAttempts")} />
        <SummaryCard icon="✓" value={best === null ? "—" : `${best}/990`} label={t("historyBestFullScore")} tone="emerald" />
        <SummaryCard icon="◉" value={average === null ? "—" : `${average}/990`} label={t("historyAverageFullScore")} tone="violet" />
        <SummaryCard icon="◷" value={formatDate(latest, language)} label={t("latestActivity")} tone="amber" />
      </section>

      <section className="flex flex-col gap-3 lg:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 focus-within:border-sky-400">
          <span className="text-slate-400">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("searchTests")} className="w-full bg-transparent py-3 text-sm outline-none" />
        </label>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm font-semibold">
          {[["ALL",t("allTime")],["7",t("last7Days")],["30",t("last30Days")]].map(([value,label]) => <button key={value} type="button" onClick={() => { setPeriod(value); setPage(1); }} className={`rounded-md px-4 py-2 ${period === value ? "bg-sky-50 text-sky-600" : "text-slate-600"}`}>{label}</button>)}
        </div>
        <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><option value="ALL">{t("modeAll")}</option><option value="FULL_TEST">{t("historyMockExam")}</option><option value="PRACTICE">{t("practice")}</option></select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><option value="ALL">{t("statusFilterAll")}</option><option value="IN_PROGRESS">{t("inProgress")}</option><option value="PAUSED">{t("practicePaused")}</option><option value="COMPLETED">{t("completed")}</option></select>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-400"><tr><th className="px-6 py-4 font-medium">{t("testNameLabel")}</th><th className="px-4 py-4 font-medium">{t("historyModeLabel")}</th><th className="px-4 py-4 font-medium">{t("historyScopeLabel")}</th><th className="px-4 py-4 font-medium">{t("resultLabel")}</th><th className="px-4 py-4 font-medium">{t("historyTimeLimit")}</th><th className="px-4 py-4 font-medium">{t("dateLabel")}</th><th className="px-4 py-4 font-medium">{t("statusLabel")}</th><th className="px-6 py-4 text-right font-medium">{t("actionLabel")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((attempt) => {
                const completed = attempt.status === "COMPLETED";
                const practice = attempt.type === "PRACTICE";
                const paused = attempt.status === "PAUSED";
                const submitted = completed && Boolean(attempt.submittedAt);
                const date = submitted ? attempt.submittedAt : attempt.updatedAt || attempt.startedAt;
                const dateLabel = submitted ? "historyDateSubmitted"
                  : attempt.updatedAt ? "historyDateUpdated" : "historyDateStarted";
                return (
                  <tr key={attempt.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-semibold">{getTestName(attempt.testId)}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${practice ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{practice ? t("practice") : t("historyMockExam")}</span></td>
                    <td className="px-4 py-4 text-slate-500">{attemptLabel(attempt, t)}</td>
                    <td className="px-4 py-4 font-semibold text-sky-700">{attemptResultLabel(attempt, t)}</td>
                    <td className="px-4 py-4 text-slate-600">{attemptTimeLimitLabel(attempt, t)}</td>
                    <td className="px-4 py-4 text-slate-600">
                      <div className="whitespace-nowrap">{formatDate(date, language)}</div>
                      {date && <div className="text-xs text-slate-500">{t(dateLabel)}</div>}
                    </td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{completed ? t("completed") : t(paused ? "practicePaused" : "inProgress")}</span>
                      {paused && Number.isFinite(attempt.pausedRemainingSeconds) && (
                        <div className="mt-1 text-xs text-slate-600">
                          {t("practiceTimeLeft").replace("{time}", formatClock(attempt.pausedRemainingSeconds))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4"><div className="flex justify-end gap-3 whitespace-nowrap">
                      {completed ? <><button type="button" onClick={() => navigate(`/full-test/${attempt.id}/result`)} className="font-semibold text-sky-600 hover:text-sky-700">{t("viewResults")}</button><button type="button" onClick={() => navigate(`/full-test/${attempt.id}/review`)} className="font-semibold text-slate-500 hover:text-slate-800">{t("reviewAnswers")}</button></> : <button type="button" onClick={() => navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } })} className="font-semibold text-sky-600">{t("continue")}</button>}
                      <button type="button" onClick={() => setDeleteTarget(attempt)} className="font-semibold text-red-500 hover:text-red-700">{t("delete")}</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visible.length && <div className="py-16 text-center text-sm text-slate-500">{loading ? t("loadingAttemptHistory") : t("noMatchingAttempts")}</div>}
      </section>

      <footer className="flex flex-col justify-between gap-3 text-sm text-slate-500 sm:flex-row sm:items-center">
        <span>{t("showingResultsPrefix")} {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} {t("showingResultsMiddle")} {filtered.length} {t("showingResultsSuffix")}</span>
        <div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((number) => <button key={number} type="button" onClick={() => setPage(number)} className={`h-9 w-9 rounded-lg border ${page === number ? "border-sky-500 bg-sky-500 text-white" : "border-slate-200 bg-white"}`}>{number}</button>)}<button type="button" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">›</button></div>
      </footer>

      {deleteTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">{t("deleteAttemptTitle")}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t("deleteAttemptDescription")}</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-semibold">{t("cancel")}</button><button type="button" onClick={confirmDelete} disabled={deleting} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white disabled:bg-red-300">{deleting ? t("deleting") : t("delete")}</button></div></section></div>}
    </div>
  );
}
