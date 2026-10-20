import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import ProAvatarBadge from "../../components/user/ProAvatarBadge";
import {
  aggregatePartAccuracy,
  computeStudyStreak,
  getAttemptHistory,
  getStatistics,
} from "../../api/userLearning";

const PART_NAMES = [
  "Part 1: Photographs",
  "Part 2: Question - Response",
  "Part 3: Conversations",
  "Part 4: Talks",
  "Part 5: Incomplete Sentences",
  "Part 6: Text Completion",
  "Part 7: Reading Comprehension",
];

function getInitials(displayName) {
  const words = (displayName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function partBarColor(percent) {
  if (percent >= 85) return "bg-emerald-500";
  if (percent >= 75) return "bg-sky-500";
  return "bg-amber-500";
}

function StatCard({ icon, value, label }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-lg">
        {icon}
      </span>
      <span>
        <span className="block text-xl font-bold text-slate-950">{value}</span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { profile, profileLoading, profileError } = useAuth();
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(0);
  const [partAccuracy, setPartAccuracy] = useState({});
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statistics, attempts] = await Promise.all([
          getStatistics(),
          getAttemptHistory().catch(() => []),
        ]);
        if (cancelled) return;
        setStats(statistics || {});
        setStreak(computeStudyStreak(attempts));
        setPartAccuracy(aggregatePartAccuracy(attempts));
      } catch {
        if (!cancelled) setStats({});
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (profileLoading && !profile) {
    return (
      <div className="mx-auto max-w-[1380px]">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {t("loadingProfile")}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-[1380px]">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {profileError || t("profileLoadFailed")}
        </div>
      </div>
    );
  }

  const name = profile.displayName || "—";
  const isPro = profile.subscription?.planCode === "PRO" && profile.subscription?.effective === true;
  const targetScore = Number(profile.targetScore) || 0;
  const averageScore = Number(stats?.averageScore) || 0;
  const goalPercent = targetScore > 0 ? Math.min(100, Math.round((averageScore / targetScore) * 100)) : 0;

  return (
    <div className="mx-auto max-w-[1380px]">
      {/* Profile header card */}
      <section className="rounded-3xl border border-white/80 bg-gradient-to-r from-blue-100 via-blue-50 to-slate-50 p-6 shadow-[0_12px_30px_-12px_rgba(30,64,100,0.35)] sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-7">
          <span className="relative inline-flex w-fit shrink-0">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={name}
                referrerPolicy="no-referrer"
                className="h-24 w-24 rounded-full border-[6px] border-white object-cover shadow-lg sm:h-28 sm:w-28"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-white bg-sky-100 text-3xl font-bold text-sky-600 shadow-lg sm:h-28 sm:w-28">
                {getInitials(profile.displayName)}
              </span>
            )}
            <ProAvatarBadge subscription={profile.subscription} large />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl lg:text-4xl">{name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-200 px-4 py-1.5 text-sm font-medium text-blue-800">
                {t("learner")}
              </span>
              {isPro && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-4 py-1.5 text-sm font-semibold text-amber-900">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="m12 2.5 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.32l-5.8 3.05 1.1-6.47-4.69-4.58 6.49-.94L12 2.5Z" />
                  </svg>
                  Pro
                </span>
              )}
            </div>
            <p className="mt-3 break-all text-sm text-slate-500">{profile.email || ""}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/profile/edit")}
            className="shrink-0 self-start rounded-xl border border-sky-200 bg-white/80 px-5 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:self-center"
          >
            {t("editProfile")}
          </button>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* TOEIC goal card */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-slate-950">{t("profileToeicGoalTitle")}</h3>
              {targetScore > 0 && (
                <span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-600">
                  {t("profileGoalLabel")}: {targetScore}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("profileToeicGoalDesc")}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">{t("profileCurrentAverage")}</span>
              <span className="font-semibold text-slate-800">
                {dataLoading ? "…" : `${averageScore} / ${targetScore} (${goalPercent}%)`}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${goalPercent}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate("/profile/edit")}
              className="mt-4 rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              {t("profileUpdateGoal")}
            </button>
          </section>

          {/* Overall stats */}
          <h3 className="font-bold text-slate-950">{t("profileStatsTitle")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon="▦"
              value={dataLoading ? "…" : stats?.totalAttempts ?? 0}
              label={t("profileTotalTests")}
            />
            <StatCard
              icon="◔"
              value={dataLoading ? "…" : averageScore}
              label={t("profileAvgScore")}
            />
            <StatCard
              icon="✓"
              value={dataLoading ? "…" : stats?.bestScore ?? 0}
              label={t("profileBestScore")}
            />
            <StatCard
              icon="🔥"
              value={dataLoading ? "…" : `${streak} ${t("profileStreakDays")}`}
              label={t("profileStreak")}
            />
          </div>
        </div>

        {/* Per-part accuracy */}
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-950">{t("profilePartAccuracy")}</h3>
          <p className="mt-1 text-xs text-slate-500">{t("profilePartAccuracyDesc")}</p>
          <div className="mt-5 space-y-4">
            {PART_NAMES.map((partName, index) => {
              const part = index + 1;
              const data = partAccuracy[part];
              const percent =
                data && data.questions > 0
                  ? Math.round((data.correct / data.questions) * 100)
                  : null;
              return (
                <div key={partName}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{partName}</span>
                    <span className="font-semibold text-slate-800">
                      {percent === null ? "—" : `${percent}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${percent === null ? "" : partBarColor(percent)}`}
                      style={{ width: `${percent ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {Object.keys(partAccuracy).length === 0 && !dataLoading && (
            <p className="mt-4 text-xs text-slate-400">{t("profileNoPartData")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
