import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import ExamHeader from "../components/ExamHeader";
import ExamNavigationBar from "../components/ExamNavigationBar";
import LockedExamAudio from "../components/LockedExamAudio";
import PassagePanel from "../components/PassagePanel";
import QuestionCard from "../components/QuestionCard";
import QuestionNavigatorDrawer from "../components/QuestionNavigatorDrawer";
import ResizableExamLayout from "../components/ResizableExamLayout";
import {
  TIMER_TYPES,
  getTimerSeconds,
  getTimerType,
  shouldDisableSubmit,
  shouldSubmitAfterListeningAudio,
} from "../config/examTiming";
import {
  buildListeningUnits,
  buildReadingUnits,
  findUnit,
  formatQuestionProgress,
} from "../utils/testData";
import { useLanguage } from "../i18n/LanguageContext";

function secondsUntil(endAt, serverNow) {
  return Math.max(0, Math.ceil((endAt - serverNow) / 1000));
}

function SubmitDialog({ unansweredCount, submitting, onCancel, onConfirm }) {
  const { t } = useLanguage();
  const hasUnansweredQuestions = unansweredCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{t("submitTest")}</p>
        <h2 id="submit-title" className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
          {t("submitAnswersNow")}
        </h2>
        <p className="mt-4 leading-7 text-slate-600">
          {hasUnansweredQuestions ? (
            <>
              {t("unansweredWarningPrefix")} <strong className="text-amber-700">{unansweredCount} {t("unanswered").toLowerCase()}</strong>. {t("unansweredWarningSuffix")}
            </>
          ) : (
            t("allAnswered")
          )}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {t("answersLockedAfterSubmit")}
        </p>
        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t("continueTest")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
          >
            {submitting ? t("saving") : t("submitTest")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FullTestExam() {
  const { t } = useLanguage();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [sectionRemainingSeconds, setSectionRemainingSeconds] = useState(null);
  const [clockSkew, setClockSkew] = useState(0);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Synced");
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [sectionNotice, setSectionNotice] = useState(false);
  const [audioAdvanceError, setAudioAdvanceError] = useState("");
  const pendingSaves = useRef(new Map());
  const answersRef = useRef({});
  const audioAdvanceInFlight = useRef(false);
  const submitInFlight = useRef(false);
  const hasSubmitted = useRef(false);
  const timeoutHandled = useRef(false);
  const readingContentRef = useRef(null);
  const readingQuestionsRef = useRef(null);
  const nextMediaPreloadRef = useRef(null);
  const [loadedListeningImageUrl, setLoadedListeningImageUrl] = useState(null);
  const [failedListeningImageUrl, setFailedListeningImageUrl] = useState(null);
  const [listeningImageRetryKey, setListeningImageRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/attempts/${attemptId}/exam`)
      .then((data) => {
        if (!active) return;
        const serverNow = data.attempt.serverTime || Date.now();
        setPayload(data);
        setAnswers(data.attempt.answers || {});
        answersRef.current = data.attempt.answers || {};
        setClockSkew(serverNow - Date.now());
        setRemainingSeconds(getTimerSeconds(data.attempt, serverNow));
        setSectionRemainingSeconds(secondsUntil(data.attempt.sectionEndAt, serverNow));
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 409) {
          navigate(`/full-test/${attemptId}/result`, { replace: true });
          return;
        }
        setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [attemptId, navigate]);

  const scopeFirst = payload?.attempt.firstQuestionNumber || 1;
  const scopeLast = payload?.attempt.lastQuestionNumber || 200;
  const selectedParts = useMemo(() => (
    payload?.attempt.selectedParts?.length
      ? payload.attempt.selectedParts
      : payload?.attempt.selectedPart
        ? [payload.attempt.selectedPart]
        : null
  ), [payload]);
  const listeningUnits = useMemo(
    () => buildListeningUnits(payload?.test).filter(
      (unit) => unit.start >= scopeFirst
        && unit.end <= scopeLast
        && (!selectedParts || selectedParts.includes(unit.partNumber)),
    ),
    [payload?.test, scopeFirst, scopeLast, selectedParts],
  );
  const readingUnits = useMemo(
    () => buildReadingUnits(payload?.test).filter(
      (unit) => unit.start >= scopeFirst
        && unit.end <= scopeLast
        && (!selectedParts || selectedParts.includes(unit.partNumber)),
    ),
    [payload?.test, scopeFirst, scopeLast, selectedParts],
  );

  const attempt = payload?.attempt;
  const timerType = getTimerType(attempt?.mode, attempt?.selectedPart);
  const currentQuestion = attempt?.currentQuestionNumber || 1;
  const currentUnits = attempt?.currentSection === "LISTENING" ? listeningUnits : readingUnits;
  const currentUnit = findUnit(currentUnits, currentQuestion);
  const currentListeningImageUrl = attempt?.currentSection === "LISTENING"
    ? currentUnit?.imageUrl
    : null;
  const listeningImageReady = !currentListeningImageUrl
    || loadedListeningImageUrl === currentListeningImageUrl;
  const listeningImageFailed = Boolean(
    currentListeningImageUrl
    && failedListeningImageUrl === currentListeningImageUrl,
  );
  const navigatorGroups = useMemo(() => {
    const grouped = new Map();
    currentUnits.forEach((unit) => {
      const questions = grouped.get(unit.partNumber) || [];
      unit.questions.forEach((question) => {
        if (!questions.includes(question.questionNumber)) questions.push(question.questionNumber);
      });
      grouped.set(unit.partNumber, questions);
    });
    return [...grouped.entries()].map(([partNumber, questions]) => ({
      partNumber,
      questions: questions.sort((left, right) => left - right),
    }));
  }, [currentUnits]);
  const scopeQuestionNumbers = useMemo(() => [...new Set(
    [...listeningUnits, ...readingUnits]
      .flatMap((unit) => unit.questions.map((question) => question.questionNumber)),
  )].sort((left, right) => left - right), [listeningUnits, readingUnits]);
  const totalQuestions = attempt?.totalQuestions
    || scopeQuestionNumbers.length
    || scopeLast - scopeFirst + 1;
  const progressLabel = formatQuestionProgress(
    scopeQuestionNumbers,
    attempt?.currentSection === "LISTENING"
      ? (currentUnit?.questions || []).map((question) => question.questionNumber)
      : [currentQuestion],
    totalQuestions,
  );
  const answeredCount = Object.entries(answers).filter(
    ([number, value]) => Number(number) >= scopeFirst && Number(number) <= scopeLast && value,
  ).length;
  const unansweredCount = totalQuestions - answeredCount;

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    audioAdvanceInFlight.current = false;
    readingContentRef.current?.scrollTo({ top: 0 });
    readingQuestionsRef.current?.scrollTo({ top: 0 });
  }, [currentUnit?.key]);

  useEffect(() => {
    if (attempt?.currentSection !== "LISTENING" || !currentUnit) return;

    const currentIndex = listeningUnits.findIndex((unit) => unit.key === currentUnit.key);
    const nextUnit = listeningUnits[currentIndex + 1];
    if (!nextUnit || nextMediaPreloadRef.current?.key === nextUnit.key) return;

    const image = nextUnit.imageUrl ? new Image() : null;
    if (image) {
      image.decoding = "async";
      image.fetchPriority = "low";
      image.src = nextUnit.imageUrl;
    }

    const audio = nextUnit.audioUrl ? document.createElement("audio") : null;
    if (audio) {
      audio.preload = "auto";
      audio.src = nextUnit.audioUrl;
      audio.load();
    }

    nextMediaPreloadRef.current = { key: nextUnit.key, image, audio };
  }, [attempt?.currentSection, currentUnit, listeningUnits]);

  useEffect(() => () => {
    const preloadedAudio = nextMediaPreloadRef.current?.audio;
    if (preloadedAudio) {
      preloadedAudio.pause();
      preloadedAudio.removeAttribute("src");
      preloadedAudio.load();
    }
    nextMediaPreloadRef.current = null;
  }, []);

  useEffect(() => {
    if (attempt?.currentSection !== "READING") return;
    readingQuestionsRef.current
      ?.querySelector(`#question-${currentQuestion}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [attempt?.currentSection, currentQuestion]);

  useEffect(() => {
    if (!attempt?.sectionEndAt) return undefined;

    const updateClock = () => {
      const serverNow = Date.now() + clockSkew;
      setRemainingSeconds(getTimerSeconds(attempt, serverNow));
      setSectionRemainingSeconds(secondsUntil(attempt.sectionEndAt, serverNow));
    };
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [attempt, clockSkew]);

  const saveAnswer = (questionNumber, selectedAnswer) => {
    const previousAnswer = answers[String(questionNumber)] ?? null;
    answersRef.current = {
      ...answersRef.current,
      [questionNumber]: selectedAnswer,
    };
    setAnswers((current) => ({ ...current, [questionNumber]: selectedAnswer }));
    setSaveState("Saving...");

    const previousSave = pendingSaves.current.get(questionNumber) || Promise.resolve();
    const savePromise = previousSave
      .catch(() => undefined)
      .then(() => apiFetch(`/api/attempts/${attemptId}/answers`, {
        method: "PUT",
        body: JSON.stringify({ questionNumber, selectedAnswer }),
      }))
      .then(() => {
        setSaveState("Autosaved");
      })
      .catch((requestError) => {
        setAnswers((current) =>
          current[String(questionNumber)] === selectedAnswer
            ? { ...current, [questionNumber]: previousAnswer }
            : current,
        );
        if (answersRef.current[String(questionNumber)] === selectedAnswer) {
          answersRef.current = {
            ...answersRef.current,
            [questionNumber]: previousAnswer,
          };
        }
        setSaveState("Save failed");
        setError(requestError.message);
        throw requestError;
      })
      .finally(() => {
        if (pendingSaves.current.get(questionNumber) === savePromise) {
          pendingSaves.current.delete(questionNumber);
        }
      });

    pendingSaves.current.set(questionNumber, savePromise);
    return savePromise;
  };

  const waitForPendingSaves = useCallback(async () => {
    const saves = [...pendingSaves.current.values()];
    if (saves.length) await Promise.all(saves);
  }, []);

  const closeNavigator = useCallback(() => setShowNavigator(false), []);

  const saveCurrentAnswers = useCallback(async () => {
    if (!currentUnit) return;
    await waitForPendingSaves();
    setSaveState("Saving...");
    await Promise.all(
      currentUnit.questions.map((question) =>
        apiFetch(`/api/attempts/${attemptId}/answers`, {
          method: "PUT",
          body: JSON.stringify({
            questionNumber: question.questionNumber,
            selectedAnswer: answersRef.current[String(question.questionNumber)] || null,
          }),
        }),
      ),
    );
    setSaveState("Autosaved");
  }, [attemptId, currentUnit, waitForPendingSaves]);

  const submitExamOnce = useCallback(async ({ saveCurrent = true } = {}) => {
    if (submitInFlight.current || hasSubmitted.current) return false;

    submitInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (saveCurrent) {
        await saveCurrentAnswers();
      } else {
        await waitForPendingSaves();
      }
      await apiFetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      hasSubmitted.current = true;
      navigate(`/full-test/${attemptId}/result`, { replace: true });
      return true;
    } catch (requestError) {
      submitInFlight.current = false;
      setError(requestError.message);
      setBusy(false);
      setShowSubmit(false);
      return false;
    }
  }, [attemptId, navigate, saveCurrentAnswers, waitForPendingSaves]);

  const timeoutRemainingSeconds = timerType === TIMER_TYPES.ELAPSED
    ? null
    : attempt?.mode === "PART"
      ? remainingSeconds
      : sectionRemainingSeconds;

  useEffect(() => {
    if (
      !attempt
      || timeoutRemainingSeconds === null
      || timeoutRemainingSeconds > 0
      || audioAdvanceInFlight.current
      || timeoutHandled.current
    ) return;
    timeoutHandled.current = true;

    const handleTimeout = async () => {
      if (attempt.currentSection !== "LISTENING" || attempt.mode !== "FULL") {
        const submitted = await submitExamOnce({ saveCurrent: attempt.mode === "PART" });
        if (!submitted && !submitInFlight.current && !hasSubmitted.current) {
          timeoutHandled.current = false;
        }
        return;
      }

      try {
        const nextAttempt = await apiFetch(
          `/api/attempts/${attemptId}/finish-listening`,
          { method: "POST" },
        );
        const serverNow = nextAttempt.serverTime || Date.now();
        if (nextAttempt.status === "COMPLETED") {
          hasSubmitted.current = true;
          navigate(`/full-test/${attemptId}/result`, { replace: true });
          return;
        }
        setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
        setAnswers(nextAttempt.answers || {});
        answersRef.current = nextAttempt.answers || {};
        setClockSkew(serverNow - Date.now());
        setRemainingSeconds(getTimerSeconds(nextAttempt, serverNow));
        setSectionRemainingSeconds(secondsUntil(nextAttempt.sectionEndAt, serverNow));
        setSectionNotice(true);
        timeoutHandled.current = false;
      } catch (requestError) {
        setError(requestError.message);
        timeoutHandled.current = false;
      }
    };

    handleTimeout();
  }, [
    attempt,
    attemptId,
    navigate,
    submitExamOnce,
    timeoutRemainingSeconds,
  ]);

  const advanceListeningAfterAudio = async () => {
    if (!currentUnit || audioAdvanceInFlight.current) return;
    audioAdvanceInFlight.current = true;
    setBusy(true);
    setError("");
    setAudioAdvanceError("");
    try {
      await saveCurrentAnswers();
      if (shouldSubmitAfterListeningAudio(attempt, currentUnit, listeningUnits)) {
        const submitted = await submitExamOnce({ saveCurrent: false });
        if (!submitted && !submitInFlight.current && !hasSubmitted.current) {
          audioAdvanceInFlight.current = false;
          setAudioAdvanceError(
            t("submitFailedAfterSave"),
          );
        }
        return;
      }

      const nextAttempt = await apiFetch(
        `/api/attempts/${attemptId}/listening/next`,
        { method: "POST" },
      );
      if (nextAttempt.status === "COMPLETED") {
        hasSubmitted.current = true;
        navigate(`/full-test/${attemptId}/result`, { replace: true });
        return;
      }
      setAudioAdvanceError("");
      setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
      setAnswers(nextAttempt.answers || answersRef.current);
      answersRef.current = nextAttempt.answers || answersRef.current;
      if (attempt.currentSection === "LISTENING" && nextAttempt.currentSection === "READING") {
        setSectionNotice(true);
      }
      setSaveState("Autosaved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
      setAudioAdvanceError(
        t("autoAdvanceFailed"),
      );
      audioAdvanceInFlight.current = false;
    } finally {
      setBusy(false);
    }
  };

  const moveReading = async (questionNumber) => {
    const readingStart = Math.max(101, scopeFirst);
    if (questionNumber < readingStart || questionNumber > scopeLast || busy) return;
    setBusy(true);
    setError("");
    try {
      await waitForPendingSaves();
      const nextAttempt = await apiFetch(`/api/attempts/${attemptId}/position`, {
        method: "PUT",
        body: JSON.stringify({ questionNumber }),
      });
      setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
      setAnswers(nextAttempt.answers || answers);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const exitExam = () => {
    const shouldExit = window.confirm(
      t("exitConfirm"),
    );
    if (shouldExit) navigate("/dashboard");
  };

  const markListeningImageReady = async (event) => {
    const image = event.currentTarget;
    const imageUrl = mediaImage;

    try {
      await image.decode();
    } catch {
      if (!image.complete || image.naturalWidth === 0) {
        setFailedListeningImageUrl(imageUrl);
        return;
      }
    }

    setFailedListeningImageUrl((current) => current === imageUrl ? null : current);
    setLoadedListeningImageUrl(imageUrl);
  };

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-bold">{t("unableOpenTest")}</p>
          <p className="mt-2 text-sm leading-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-5 rounded-xl bg-white px-4 py-2 font-semibold text-slate-700"
          >
            {t("returnToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  if (!payload || !currentUnit) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">{t("restoringTest")}</div>;
  }

  const isListening = attempt.currentSection === "LISTENING";
  const readingQuestionNumbers = [...new Set(
    readingUnits.flatMap((unit) => unit.questions.map((question) => question.questionNumber)),
  )].sort((left, right) => left - right);
  const currentReadingIndex = readingQuestionNumbers.indexOf(currentQuestion);
  const previousReadingQuestion = currentReadingIndex > 0
    ? readingQuestionNumbers[currentReadingIndex - 1]
    : null;
  const nextReadingQuestion = currentReadingIndex >= 0
    && currentReadingIndex < readingQuestionNumbers.length - 1
    ? readingQuestionNumbers[currentReadingIndex + 1]
    : null;
  const mediaImage = currentUnit.imageUrl;
  const mediaAudio = currentUnit.audioUrl;
  const readingPanelImageUrls = new Set([
    ...(currentUnit.imageUrls || []),
    ...(currentUnit.passages || []).map((passage) => passage.imageUrl),
  ].filter(Boolean));
  const shouldRenderStandaloneReadingImage = mediaImage && !readingPanelImageUrls.has(mediaImage);
  const hasReadingMaterial = Boolean(
    mediaImage
    || currentUnit.imageUrls?.length
    || currentUnit.passages?.length,
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <ExamHeader
        testId={payload.test?.testId || attempt.testId}
        section={attempt.currentSection}
        type={attempt.type}
        mode={attempt.mode}
        selectedPart={attempt.selectedPart}
        selectedParts={attempt.selectedParts}
        firstQuestion={scopeFirst}
        lastQuestion={scopeLast}
        remainingSeconds={remainingSeconds ?? 0}
        timerType={timerType}
        onExit={exitExam}
      />

      {sectionNotice && attempt.currentSection === "READING" && (
        <div className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-2xl">
          <p className="font-bold text-emerald-700">{t("listeningEnded")}</p>
          <p className="mt-1 text-sm text-slate-600">
            {attempt.mode === "PART"
              ? t("selectedReadingStarting")
              : t("readingStarting")}
          </p>
          <button
            type="button"
            onClick={() => setSectionNotice(false)}
            className="mt-4 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            {t("continue")}
          </button>
        </div>
      )}

      <main className="w-full px-3 py-3 pb-28 sm:px-5 lg:px-6 xl:pb-5">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        <div className="w-full">
          <section className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <div>
                <h1 className="text-base font-bold text-slate-950 sm:text-lg">
                  {isListening
                    ? `${t("questions")} ${currentUnit.start}${currentUnit.end !== currentUnit.start ? `–${currentUnit.end}` : ""}`
                    : `${t("question")} ${currentQuestion} · ${t("range")} ${scopeFirst}–${scopeLast}`}
                </h1>
                <p className="mt-0.5 text-xs font-semibold text-sky-700">
                  {t("part")} {currentUnit.partNumber} · {currentUnit.partName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${saveState === "Save failed" ? "bg-red-500" : saveState === "Saving..." ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
                {saveState === "Save failed" ? t("saveFailed") : saveState === "Saving..." ? t("saving") : saveState === "Synced" ? t("synced") : t("autosaved")}
              </div>
            </div>

            <ResizableExamLayout
              leftLabel={isListening ? t("listeningContent") : t("readingContent")}
              rightLabel={t("questionsAnswers")}
              left={(
                <section
                  ref={readingContentRef}
                  aria-label={isListening ? t("listeningContent") : t("readingContent")}
                  className="min-w-0 space-y-3 xl:h-[calc(100dvh-12rem)] xl:overflow-y-auto xl:pr-1"
                >
                  {isListening ? (
                    <>
                      {mediaAudio ? (
                        <LockedExamAudio
                          key={currentUnit.key}
                          src={mediaAudio}
                          advancing={busy}
                          paused={showSubmit}
                          ready={listeningImageReady}
                          onEnded={advanceListeningAfterAudio}
                        />
                      ) : (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          {t("missingAudio")}
                        </div>
                      )}

                      {mediaImage && (
                        <div className="relative min-h-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-center">
                          {!listeningImageReady && !listeningImageFailed && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 px-6 text-sm font-semibold text-slate-600" role="status">
                              <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                              {t("imagePreparing")}
                            </div>
                          )}

                          {listeningImageFailed && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50 px-6 text-sm text-red-700" role="alert">
                              <p className="font-semibold">{t("imageLoadFailed")}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setFailedListeningImageUrl(null);
                                  setLoadedListeningImageUrl(null);
                                  setListeningImageRetryKey((current) => current + 1);
                                }}
                                className="rounded-xl bg-white px-4 py-2 font-bold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100"
                              >
                                {t("retryImage")}
                              </button>
                            </div>
                          )}

                          <img
                            key={`${mediaImage}-${listeningImageRetryKey}`}
                            src={mediaImage}
                            alt={`Graphic for questions ${currentUnit.start} to ${currentUnit.end}`}
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            onLoad={markListeningImageReady}
                            onError={() => setFailedListeningImageUrl(mediaImage)}
                            className={`mx-auto h-auto max-h-[65vh] max-w-full rounded-xl object-contain transition-opacity ${listeningImageReady ? "opacity-100" : "opacity-0"}`}
                          />
                        </div>
                      )}

                      <PassagePanel compact passages={currentUnit.passages || []} />
                    </>
                  ) : (
                    <>
                      {shouldRenderStandaloneReadingImage && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                          <img
                            src={mediaImage}
                            alt={`Material for question ${currentUnit.start}`}
                            className="mx-auto h-auto w-full rounded-xl object-contain"
                          />
                        </div>
                      )}

                      <PassagePanel
                        compact
                        passages={currentUnit.passages || []}
                        imageUrls={currentUnit.imageUrls || []}
                      />

                      {!hasReadingMaterial && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-6 text-slate-500">
                          {t("missingReading")}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
              right={(
                <section
                  aria-label={t("questionsAnswers")}
                  className="min-w-0 xl:flex xl:h-[calc(100dvh-12rem)] xl:flex-col xl:pl-1"
                >
                  <div
                    ref={readingQuestionsRef}
                    className="min-w-0 space-y-3 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                  >
                    <div className="space-y-3 pb-4">
                      {currentUnit.questions.map((question) => (
                        <QuestionCard
                          key={question.questionNumber}
                          question={question}
                          selectedAnswer={answers[String(question.questionNumber)] || null}
                          onSelect={(answer) => {
                            saveAnswer(question.questionNumber, answer).catch(() => undefined);
                          }}
                          disabled={isListening && busy}
                          hideOptionContent={isListening && currentUnit.partNumber <= 2}
                          isFocused={question.questionNumber === currentQuestion}
                          compact
                        />
                      ))}
                    </div>
                  </div>

                  <ExamNavigationBar
                    progressLabel={progressLabel}
                    onOpenNavigator={() => setShowNavigator(true)}
                    onPrevious={isListening
                      ? undefined
                      : () => moveReading(previousReadingQuestion)}
                    onNext={isListening
                      ? advanceListeningAfterAudio
                      : () => moveReading(nextReadingQuestion)}
                    onSubmit={() => setShowSubmit(true)}
                    previousDisabled={isListening || previousReadingQuestion === null || busy}
                    nextDisabled={isListening
                      ? busy || (Boolean(mediaAudio) && !audioAdvanceError)
                      : nextReadingQuestion === null || busy}
                    submitDisabled={shouldDisableSubmit(attempt, busy)}
                    previousTitle={isListening
                      ? t("listeningLocked")
                      : undefined}
                    nextTitle={isListening && mediaAudio && !audioAdvanceError
                      ? t("nextGroupAuto")
                      : undefined}
                    statusMessage={isListening
                      ? audioAdvanceError
                        ? t("nextGroupRetry")
                        : mediaAudio
                          ? t("nextListeningAuto")
                          : t("audioUnavailable")
                      : undefined}
                  />
                </section>
              )}
            />
          </section>
        </div>
      </main>

      {showSubmit && (
        <SubmitDialog
          unansweredCount={unansweredCount}
          submitting={busy}
          onCancel={() => setShowSubmit(false)}
          onConfirm={() => submitExamOnce()}
        />
      )}

      <QuestionNavigatorDrawer
        open={showNavigator}
        onClose={closeNavigator}
        groups={navigatorGroups}
        currentQuestion={currentQuestion}
        answers={answers}
        navigationLocked={isListening}
        onSelect={isListening ? null : moveReading}
      />
    </div>
  );
}

export default FullTestExam;
