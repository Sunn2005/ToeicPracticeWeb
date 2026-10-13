import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useUserAttempts } from "../../hooks/useUserAttempts";
import { getAttemptParts } from "../../utils/attemptHistory";
import { getTestName } from "../../data/testCatalog";
import { useLanguage } from "../../i18n/LanguageContext";
import { hasEffectiveAIChat } from "../../components/floatingPetInteraction";

function formatDate(timestamp, language) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(timestamp));
}

function StatCard({ icon, value, label, tone = "sky" }) {
  const tones = {
    sky: "bg-sky-50 text-sky-500",
    emerald: "bg-emerald-50 text-emerald-500",
    amber: "bg-amber-50 text-amber-500",
    violet: "bg-violet-50 text-violet-500",
  };
  return (
    <article className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${tones[tone]}`}>{icon}</span>
      <span>
        <strong className="block text-2xl font-bold text-slate-950">{value}</strong>
        <span className="text-sm text-slate-500">{label}</span>
      </span>
    </article>
  );
}

function modeName(attempt, t) {
  if (attempt.mode === "FULL") return t("fullTest");
  if (attempt.mode === "LISTENING") return t("listening");
  if (attempt.mode === "READING") return t("reading");
  return `${t("part")} ${getAttemptParts(attempt).join(", ")}`;
}

export default function UserDashboard() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const { attempts, loading, error } = useUserAttempts();
  const name = profile?.displayName || user?.displayName || "Học viên";
  const hasProAI = hasEffectiveAIChat(profile?.subscription);
  // Card upsell Pro chỉ dành cho học viên thường chưa có Pro: route /dashboard
  // không chặn role nên EMPLOYEE/ADMIN đăng nhập cũng vào được trang này.
  const showProCard = !hasProAI && role === "USER";

  const data = useMemo(() => {
    const completed = attempts.filter((attempt) => attempt.status === "COMPLETED");
    const exams = completed.filter((attempt) => attempt.type !== "PRACTICE");
    const active = attempts.filter((attempt) => attempt.status === "IN_PROGRESS");
    const listening = exams.filter((attempt) => Number(attempt.result?.listeningTotalQuestions) > 0);
    const reading = exams.filter((attempt) => Number(attempt.result?.readingTotalQuestions) > 0);
    const average = (items, key) => items.length
      ? Math.round(items.reduce((sum, item) => sum + (Number(item.result?.[key]) || 0), 0) / items.length)
      : 0;
    const days = new Set(completed.map((attempt) => formatDate(attempt.submittedAt, language))).size;
    return {
      completed,
      exams,
      active,
      listeningAverage: average(listening, "listeningScore"),
      readingAverage: average(reading, "readingScore"),
      activeDays: days,
    };
  }, [attempts, language]);

  const resume = data.active[0];
  const recent = attempts.slice(0, 4);
  const chartPoints = data.exams.slice(0, 6).reverse();
  const pointString = chartPoints.map((attempt, index) => {
    const x = chartPoints.length === 1 ? 50 : 8 + (index * 84) / (chartPoints.length - 1);
    const score = Number(attempt.result?.totalScore) || 0;
    const y = 88 - (score / 990) * 70;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="mx-auto max-w-[1380px] space-y-7">
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white px-6 py-7 shadow-sm sm:px-8 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">{t("welcomeLearner")}, {name} 👋</h2>
          <p className="mt-1 text-slate-600">{t("dashboardEncouragement")}</p>
          <p className="mt-2 text-sm text-slate-400">{new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p>
        </div>
        <button type="button" onClick={() => navigate("/tests")} className="rounded-lg bg-sky-500 px-7 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-600">{t("practiceNow")}</button>
      </section>

      {showProCard && (
        <article className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-sky-50 p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-violet-100" aria-hidden="true">🦫</span>
            <div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">{t("proBenefitsBadge")}</span>
              <h2 className="mt-3 text-xl font-bold text-slate-950">{t("proBenefitsTitle")}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("proBenefitsDescription")}</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-700" aria-label={t("proBenefitsTitle")}>
                <li>✓ {t("proBenefitsChat")}</li>
                <li>✓ {t("proBenefitsAnalysis")}</li>
              </ul>
            </div>
          </div>
        </article>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="✓" value={data.exams.length} label={t("examsCompleted")} />
        <StatCard icon="♬" value={data.listeningAverage || "—"} label={t("listeningAverage")} tone="violet" />
        <StatCard icon="▤" value={data.readingAverage || "—"} label={t("readingAverage")} tone="emerald" />
        <StatCard icon="♨" value={`${data.activeDays} ${data.activeDays === 1 ? t("day") : t("days")}`} label={t("studyDays")} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)]">
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-lg font-bold">{t("continueLearning")}</h2>
            {resume ? (
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${resume.type === "PRACTICE" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}`}>{resume.type === "PRACTICE" ? t("practice") : t("mockExam")}</span>
                    <h3 className="mt-2 font-bold">{getTestName(resume.testId)} · {modeName(resume, t)}</h3>
                  </div>
                  <span className="text-sm text-slate-400">{t("lastAccessed")}: {formatDate(resume.updatedAt, language)}</span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, Math.max(4, ((resume.currentQuestionNumber || 1) / 200) * 100))}%` }} />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => navigate(`/full-test/${resume.id}/exam`, { state: { attempt: resume } })} className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600">{t("continueAttempt")}</button>
                  <button type="button" onClick={() => navigate("/history")} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-sky-600 hover:bg-sky-50">{t("viewHistory")}</button>
                </div>
              </article>
            ) : (
              <article className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                {loading ? t("loadingLatestAttempt") : t("noActiveAttempt")}
              </article>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("recentActivity")}</h2>
              <button type="button" onClick={() => navigate("/history")} className="text-sm font-semibold text-sky-500">{t("viewHistory")}</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs text-slate-400"><tr><th className="pb-3 font-medium">{t("testNameLabel")}</th><th className="pb-3 font-medium">{t("typeLabel")}</th><th className="pb-3 font-medium">{t("resultLabel")}</th><th className="pb-3 font-medium">{t("dateLabel")}</th><th className="pb-3 font-medium">{t("statusLabel")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((attempt) => (
                    <tr key={attempt.id}>
                      <td className="py-3 font-semibold">{getTestName(attempt.testId)}</td>
                      <td className="py-3 text-slate-500">{attempt.type === "PRACTICE" ? t("practice") : modeName(attempt, t)}</td>
                      <td className="py-3 font-semibold text-sky-600">{attempt.status === "COMPLETED" ? attempt.type === "PRACTICE" ? `${attempt.result?.totalCorrect || 0}/${attempt.result?.totalQuestions || 0}` : `${attempt.result?.totalScore || 0}` : "—"}</td>
                      <td className="py-3 text-slate-400">{formatDate(attempt.submittedAt || attempt.updatedAt, language)}</td>
                      <td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attempt.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{attempt.status === "COMPLETED" ? t("completed") : t("inProgress")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!recent.length && !loading && <p className="py-8 text-center text-sm text-slate-400">{t("noLearningActivity")}</p>}
            </div>
          </div>
        </div>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">{t("yourProgress")}</h2>
          <p className="mt-1 text-sm text-slate-400">{t("latestExamScores")}</p>
          <div className="mt-6 h-72 rounded-xl bg-slate-50 p-4">
            {chartPoints.length ? (
              <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none" aria-label={t("progressChart")}>
                {[20, 40, 60, 80].map((y) => <line key={y} x1="6" x2="96" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="2 2" />)}
                <polyline points={pointString} fill="none" stroke="#0ea5e9" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {pointString.split(" ").map((point) => { const [cx, cy] = point.split(","); return <circle key={point} cx={cx} cy={cy} r="1.5" fill="#0ea5e9" />; })}
              </svg>
            ) : <div className="flex h-full items-center justify-center text-sm text-slate-400">{t("completeExamForProgress")}</div>}
          </div>
          <div className="mt-5 rounded-lg bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-600">{t("practiceScoresExcluded")}</div>
        </article>
      </section>
    </div>
  );
}
