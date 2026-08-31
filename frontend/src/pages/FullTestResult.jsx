import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { formatDuration } from "../utils/testData";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

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

function FullTestResult() {
  const { t } = useLanguage();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
  const modeTitle =
    result?.type === "PRACTICE"
      ? `${t("practiceMode")} · ${t("part")} ${selectedParts.join(" + ")}`
      : resultMode === "FULL"
        ? t("fullTest")
        : resultMode === "LISTENING"
          ? t("listeningTest")
          : resultMode === "READING"
            ? t("readingTest")
            : `${t("part")} ${selectedParts.join(" + ")} - Test 1`;
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
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-sky-300">{modeTitle} · {t("testResults")}</p>
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
