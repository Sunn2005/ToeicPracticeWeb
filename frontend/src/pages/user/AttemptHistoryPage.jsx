import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserAttempts } from "../../hooks/useUserAttempts";
import { getAttemptDurationSeconds, getAttemptParts } from "../../utils/attemptHistory";
import { getTestName } from "../../data/testCatalog";
import { useLanguage } from "../../i18n/LanguageContext";

const PAGE_SIZE = 8;
const HISTORY_REFERENCE_TIME = Date.now();

function formatDate(timestamp, language) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp));
}

function attemptLabel(attempt, t) {
  if (attempt.mode === "FULL") return t("fullTest");
  if (attempt.mode === "LISTENING") return t("listening");
  if (attempt.mode === "READING") return t("reading");
  return `${t("part")} ${getAttemptParts(attempt).join(", ")}`;
}

function SummaryCard({ icon, value, label, tone = "sky" }) {
  const tones = { sky: "bg-sky-50 text-sky-500", emerald: "bg-emerald-50 text-emerald-500", violet: "bg-violet-50 text-violet-500", amber: "bg-amber-50 text-amber-500" };
  return <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${tones[tone]}`}>{icon}</span><span><strong className="block text-2xl font-bold">{value}</strong><span className="text-sm text-slate-500">{label}</span></span></article>;
}

export default function AttemptHistoryPage() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { attempts, loading, error, remove } = useUserAttempts();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const exams = attempts.filter((attempt) => attempt.status === "COMPLETED" && attempt.type !== "PRACTICE");
  const scores = exams.map((attempt) => Number(attempt.result?.totalScore) || 0).filter(Boolean);
  const best = scores.length ? Math.max(...scores) : 0;
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const latest = attempts[0]?.updatedAt || attempts[0]?.submittedAt;

  const filtered = useMemo(() => {
    const days = period === "7" ? 7 : period === "30" ? 30 : null;
    return attempts.filter((attempt) => {
      const text = `${getTestName(attempt.testId)} ${attemptLabel(attempt, t)}`.toLowerCase();
      const timestamp = Number(attempt.submittedAt || attempt.updatedAt || attempt.startedAt) || 0;
      return text.includes(query.trim().toLowerCase())
        && (!days || HISTORY_REFERENCE_TIME - timestamp <= days * 86_400_000)
        && (type === "ALL" || attempt.type === type)
        && (status === "ALL" || attempt.status === status);
    });
  }, [attempts, period, query, status, t, type]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon="▦" value={attempts.length} label={t("totalAttempts")} />
        <SummaryCard icon="✓" value={best || "—"} label={t("bestExamScore")} tone="emerald" />
        <SummaryCard icon="◉" value={average || "—"} label={t("averageExamScore")} tone="violet" />
        <SummaryCard icon="◷" value={formatDate(latest, language)} label={t("latestActivity")} tone="amber" />
      </section>

      <section className="flex flex-col gap-3 lg:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 focus-within:border-sky-400">
          <span className="text-slate-400">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t("searchTests")} className="w-full bg-transparent py-3 text-sm outline-none" />
        </label>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm font-semibold">
          {[["ALL",t("allTime")],["7",t("last7Days")],["30",t("last30Days")]].map(([value,label]) => <button key={value} type="button" onClick={() => { setPeriod(value); setPage(1); }} className={`rounded-md px-4 py-2 ${period === value ? "bg-sky-50 text-sky-600" : "text-slate-600"}`}>{label}</button>)}
        </div>
        <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><option value="ALL">{t("modeAll")}</option><option value="FULL_TEST">{t("mockExamMode")}</option><option value="PRACTICE">{t("practice")}</option></select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"><option value="ALL">{t("statusFilterAll")}</option><option value="IN_PROGRESS">{t("inProgress")}</option><option value="COMPLETED">{t("completed")}</option></select>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-400"><tr><th className="px-6 py-4 font-medium">{t("testNameLabel")}</th><th className="px-4 py-4 font-medium">{t("typeLabel")}</th><th className="px-4 py-4 font-medium">{t("testTypeLabel")}</th><th className="px-4 py-4 font-medium">{t("resultLabel")}</th><th className="px-4 py-4 font-medium">{t("durationLabel")}</th><th className="px-4 py-4 font-medium">{t("dateLabel")}</th><th className="px-4 py-4 font-medium">{t("statusLabel")}</th><th className="px-6 py-4 text-right font-medium">{t("actionLabel")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((attempt) => {
                const completed = attempt.status === "COMPLETED";
                const practice = attempt.type === "PRACTICE";
                const duration = Math.max(1, Math.round(getAttemptDurationSeconds(attempt) / 60));
                return (
                  <tr key={attempt.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-semibold">{getTestName(attempt.testId)}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${practice ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{practice ? t("practice") : t("mockExamMode")}</span></td>
                    <td className="px-4 py-4 text-slate-500">{attemptLabel(attempt, t)}</td>
                    <td className="px-4 py-4 font-semibold text-sky-600">{completed ? practice ? `${attempt.result?.totalCorrect || 0}/${attempt.result?.totalQuestions || 0}` : `${attempt.result?.totalScore || 0}/990` : "—"}</td>
                    <td className="px-4 py-4 text-slate-500">{attempt.timed === false ? t("unlimited") : `${duration} ${t("minutes")}`}</td>
                    <td className="px-4 py-4 text-slate-400">{formatDate(attempt.submittedAt || attempt.updatedAt, language)}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{completed ? t("completed") : t("inProgress")}</span></td>
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
        <div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((number) => <button key={number} type="button" onClick={() => setPage(number)} className={`h-9 w-9 rounded-lg border ${page === number ? "border-sky-500 bg-sky-500 text-white" : "border-slate-200 bg-white"}`}>{number}</button>)}<button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">›</button></div>
      </footer>

      {deleteTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">{t("deleteAttemptTitle")}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{t("deleteAttemptDescription")}</p><div className="mt-6 flex gap-3"><button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 font-semibold">{t("cancel")}</button><button type="button" onClick={confirmDelete} disabled={deleting} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white disabled:bg-red-300">{deleting ? t("deleting") : t("delete")}</button></div></section></div>}
    </div>
  );
}
