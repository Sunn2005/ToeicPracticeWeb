import { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { apiFetch, publicApiFetch } from "../api/client";
import TestList from "../components/TestList";
import TestModeModal from "../components/TestModeModal";
import { TOEIC_TESTS } from "../data/testCatalog";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import AttemptHistoryDrawer from "../components/AttemptHistoryDrawer";
import { deleteAttempt, getAttemptHistory } from "../api/userLearning";
import { getHistoryStats } from "../utils/attemptHistory";

function UserAvatar({ user, displayName, size = "large" }) {
  const sizeClasses =
    size === "small"
      ? "h-10 w-10 rounded-xl text-sm"
      : "h-20 w-20 rounded-3xl text-2xl";

  if (user?.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={`${displayName}'s avatar`}
        referrerPolicy="no-referrer"
        className={`${sizeClasses} shrink-0 border-2 border-white object-cover shadow-md`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} flex shrink-0 items-center justify-center bg-sky-500 font-bold text-white shadow-md`}
      aria-hidden="true"
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

function Welcome({ user }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [selectedTest, setSelectedTest] = useState(null);
  const [modalTab, setModalTab] = useState("exam");
  const [tests, setTests] = useState(TOEIC_TESTS);
  const [attempts, setAttempts] = useState([]);
  const [historyTest, setHistoryTest] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const displayName = user?.displayName || t("learner");

  useEffect(() => {
    let active = true;
    Promise.all(
      TOEIC_TESTS.map(async (test) => {
        if (!test.available) return test;
        try {
          const metadata = await publicApiFetch(`/api/tests/${test.id}`);
          return {
            ...test,
            title: metadata.title || test.title,
            totalQuestions: metadata.totalQuestions || test.totalQuestions,
            duration: metadata.totalMinutes || test.duration,
          };
        } catch {
          return test;
        }
      }),
    ).then((catalog) => {
      if (active) setTests(catalog);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getAttemptHistory()
      .then((history) => {
        if (active) setAttempts(Array.isArray(history) ? history : []);
      })
      .catch((requestError) => {
        if (active) setHistoryError(requestError.message || t("historyLoadError"));
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Unable to sign out:", error);
      setSignOutError(t("signOutError"));
      setIsSigningOut(false);
    }
  };

  const handleStartExam = async ({ mode, part, parts, durationMinutes, experience }) => {
    const attempt = await apiFetch(`/api/tests/${selectedTest.id}/attempts`, {
      method: "POST",
      forceRefresh: true,
      body: JSON.stringify({
        type: experience === "practice" ? "PRACTICE" : "FULL_TEST",
        mode,
        part,
        parts,
        durationMinutes,
      }),
    });
    navigate(`/full-test/${attempt.id}/exam`);
  };

  const openTestMode = (test, tab) => {
    setModalTab(tab);
    setSelectedTest(test);
  };

  const handleDeleteAttempt = async (attemptId) => {
    await deleteAttempt(attemptId);
    setAttempts((current) => current.filter((attempt) => attempt.id !== attemptId));
  };

  const openAttemptReview = async (attempt, filter = "") => {
    setHistoryError("");

    try {
      if (attempt.status !== "COMPLETED") {
        await apiFetch(`/api/attempts/${attempt.id}/submit-for-review`, {
          method: "POST",
          forceRefresh: true,
        });
      }

      const query = filter ? `?filter=${filter}` : "";
      navigate(`/full-test/${attempt.id}/review${query}`);
    } catch (requestError) {
      setHistoryError(requestError.message || t("historyReviewError"));
    }
  };

  const learningStats = useMemo(() => getHistoryStats(attempts), [attempts]);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <header className="border-b border-white/80 bg-white/80 shadow-sm backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 rounded-xl text-left focus:outline-none focus:ring-4 focus:ring-sky-100"
            aria-label={t("goToDashboard")}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 font-bold text-white shadow-lg shadow-sky-200">
              TP
            </span>
            <span className="hidden sm:block">
              <span className="block text-lg font-bold leading-tight text-slate-950">
                TOEIC Practice
              </span>
              <span className="hidden text-xs text-slate-500 sm:block">
                {t("smarterPractice")}
              </span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="max-w-48 truncate text-xs text-slate-500">
                {user?.email}
              </p>
            </div>
            <UserAvatar user={user} displayName={displayName} size="small" />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? t("signingOut") : t("signOut")}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        {signOutError && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            {signOutError}
          </div>
        )}

        <div className="grid w-full gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-3xl bg-sky-500 p-6 text-white shadow-xl shadow-sky-200/70 sm:p-7">
              <UserAvatar user={user} displayName={displayName} />
              <p className="mt-6 text-sm font-medium text-sky-100">{t("hello")}</p>
              <h1 className="mt-1 break-words text-2xl font-bold">{displayName}</h1>
              <p className="mt-2 break-all text-sm text-sky-100">{user?.email}</p>

              <div className="mt-7 rounded-2xl bg-white/15 p-5 ring-1 ring-white/20">
                <p className="text-sm font-medium text-sky-100">{t("weeklyGoal")}</p>
                <p className="mt-2 text-3xl font-bold">{t("goalPoints")}</p>
                <p className="mt-3 text-sm leading-6 text-sky-50">
                  {t("goalDescription")}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white bg-white/80 p-6 shadow-lg shadow-sky-100/70 backdrop-blur">
              <p className="text-sm font-semibold text-slate-900">{t("todaySuggestions")}</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  {t("completePart5")}
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  {t("noteVocabulary")}
                </li>
                <li className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                  {t("reviewIncorrectAnswers")}
                </li>
              </ul>
            </section>
          </aside>

          <section className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-sky-100/70 backdrop-blur sm:p-8">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                    {t("learningOverview")}
                  </p>
                  <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                    {t("readyForPractice")}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                    {t("overviewDescription")}
                  </p>
                </div>
                <span className="w-fit shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  {t("active")}
                </span>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  [String(learningStats.completed), t("testsCompleted")],
                  [`${learningStats.accuracy}%`, t("accuracy")],
                  [`${learningStats.streak} ${learningStats.streak === 1 ? t("day") : t("days")}`, t("studyStreak")],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5"
                  >
                    <p className="text-3xl font-bold text-slate-950">{value}</p>
                    <p className="mt-2 text-sm text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white/80 p-6 shadow-xl shadow-sky-100/70 backdrop-blur sm:p-8">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-sky-600">
                    {t("testSets")}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-950">
                    {t("chooseTest")}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {t("chooseTestDescription")}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {tests.filter((test) => test.available).length} {t("testsReady")}
                </span>
              </div>

              <TestList
                tests={tests}
                attempts={attempts}
                onSelectTest={openTestMode}
                onOpenHistory={setHistoryTest}
              />
            </div>
          </section>
        </div>
      </main>

      {selectedTest && (
        <TestModeModal
          test={selectedTest}
          initialTab={modalTab}
          onClose={() => setSelectedTest(null)}
          onStart={handleStartExam}
        />
      )}

      <AttemptHistoryDrawer
        open={Boolean(historyTest)}
        attempts={attempts.filter((attempt) => attempt.testId === historyTest?.id)}
        tests={tests}
        selectedTest={historyTest}
        loading={historyLoading}
        error={historyError}
        onClose={() => setHistoryTest(null)}
        onDelete={handleDeleteAttempt}
        onReview={(attempt) => openAttemptReview(attempt)}
        onReviewIncorrect={(attempt) => openAttemptReview(attempt, "INCORRECT")}
      />
    </div>
  );
}

export default Welcome;
