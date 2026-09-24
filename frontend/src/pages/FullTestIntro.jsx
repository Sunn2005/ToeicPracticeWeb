import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch, publicApiFetch } from "../api/client";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import { getTestName, getTestTitle } from "../data/testCatalog";
import BrandLogo from "../components/BrandLogo";
import LoadingScreen from "../components/LoadingScreen";
import { buildListeningUnits, findUnit } from "../utils/testData";

function FullTestIntro() {
  const { t } = useLanguage();
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [currentAttempt, setCurrentAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const mediaPreloadRef = useRef(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      publicApiFetch(`/api/tests/${testId}`),
      apiFetch(
        `/api/attempts/current?testId=${encodeURIComponent(testId)}`,
      ).catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 404) {
          return null;
        }
        throw requestError;
      }),
    ])
      .then(([testData, attemptData]) => {
        if (!active) return;
        setTest(testData);
        setCurrentAttempt(attemptData);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [testId]);

  useEffect(() => {
    if (!test || (currentAttempt && currentAttempt.currentSection !== "LISTENING")) return;

    const listeningUnits = buildListeningUnits(test);
    const unit = currentAttempt
      ? findUnit(listeningUnits, currentAttempt.currentQuestionNumber)
      : listeningUnits[0];
    if (!unit || mediaPreloadRef.current?.key === unit.key) return;

    const image = unit.imageUrl ? new Image() : null;
    if (image) {
      image.decoding = "async";
      image.fetchPriority = "high";
      image.src = unit.imageUrl;
    }

    const audio = unit.audioUrl ? document.createElement("audio") : null;
    if (audio) {
      audio.preload = "auto";
      audio.src = unit.audioUrl;
      audio.load();
    }

    mediaPreloadRef.current = { key: unit.key, image, audio };
  }, [currentAttempt, test]);

  const startTest = async () => {
    setStarting(true);
    setError("");
    try {
      const attempt = await apiFetch(`/api/tests/${testId}/attempts`, {
        method: "POST",
      });
      navigate(`/full-test/${attempt.id}/exam`, { state: { attempt } });
    } catch (requestError) {
      setError(requestError.message);
      setStarting(false);
    }
  };

  if (loading) {
    return <LoadingScreen message={t("loadingTestInfo")} />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-sky-50 to-cyan-100 text-slate-900">
      <header className="border-b border-white/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 font-bold text-slate-950"
          >
            <BrandLogo className="h-11 w-11 rounded-xl border border-sky-100 bg-white shadow-sm" />
            <span className="hidden sm:inline">CapyTOEIC</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t("backToDashboard")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-4xl border border-white bg-white/90 shadow-2xl shadow-sky-100/80">
          <div className="bg-linear-to-r from-sky-500 to-cyan-500 px-6 py-8 text-white sm:px-10 sm:py-10">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-100">
              {t("fullTestLabel")} · {getTestName(test?.testId || testId)}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
              {test?.title || getTestTitle(testId)}
            </h1>
            <p className="mt-4 max-w-3xl leading-7 text-sky-50">
              {t("fullTestDescription")}
            </p>
          </div>

          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                {t("testStructure")}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    {t("listening")}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {t("listeningSummary")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t("listeningInstructions")}
                  </p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                    {t("reading")}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {t("readingSummary")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t("readingInstructions")}
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h3 className="font-bold text-amber-900">{t("beforeStart")}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900/80">
                  <li>• {t("headphonesTip")}</li>
                  <li>• {t("serverTimerTip")}</li>
                  <li>• {t("autoReadingTip")}</li>
                  <li>• {t("autoSubmitTip")}</li>
                </ul>
              </div>
            </div>

            <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-500">
                {t("overview")}
              </p>
              <dl className="mt-5 space-y-4">
                {[
                  [t("questions"), `${test?.totalQuestions || 200}`],
                  [
                    t("totalTime"),
                    `${test?.totalMinutes || 120} ${t("minutes")}`,
                  ],
                  [t("format"), t("fullTest")],
                  [t("results"), t("automaticallyScored")],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 border-b border-slate-200 pb-3"
                  >
                    <dt className="text-sm text-slate-500">{label}</dt>
                    <dd className="text-sm font-bold text-slate-900">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {currentAttempt && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  {t("activeAttemptPrefix")}{" "}
                  {currentAttempt.currentSection === "LISTENING"
                    ? t("listening")
                    : t("reading")}
                  {t("activeAttemptSuffix")}
                </div>
              )}

              <button
                type="button"
                onClick={startTest}
                disabled={starting}
                className="mt-6 w-full rounded-2xl bg-sky-500 px-5 py-4 font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-wait disabled:bg-sky-300"
              >
                {starting
                  ? t("preparingYourTest")
                  : currentAttempt
                    ? t("resumeTest")
                    : t("startTest")}
              </button>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

export default FullTestIntro;
