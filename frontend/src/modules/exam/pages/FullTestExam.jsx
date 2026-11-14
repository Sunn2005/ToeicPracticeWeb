import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { exitAttempt, resumePracticeAttempt } from "../../../api/attempts/lifecycle";
import { ApiError, apiFetch } from "../../../api/client";
import ExamHeader from "../components/ExamHeader";
import ExamNavigationBar from "../components/ExamNavigationBar";
import LockedExamAudio from "../components/LockedExamAudio";
import PracticeAudioPlayer from "../components/PracticeAudioPlayer";
import PassagePanel from "../components/PassagePanel";
import QuestionCard from "../components/QuestionCard";
import QuestionNavigatorDrawer from "../components/QuestionNavigatorDrawer";
import ResizableExamLayout from "../components/ResizableExamLayout";
import ReviewTogglePanel from "../components/ReviewTogglePanel";
import {
  TIMER_TYPES,
  getDisplayTimerSeconds,
  getTimerSeconds,
  getTimerType,
  shouldDisableSubmit,
} from "../config/examTiming";
import {
  buildNavigatorGroups,
  buildListeningUnits,
  buildReadingUnits,
  findUnit,
  formatQuestionProgress,
  formatClock,
} from "../utils/testData";
import { recallExamTest, rememberExamTest } from "../utils/examTestCache";
import { AnswerSaveError, createAnswerSaveQueue } from "../utils/answerSaveQueue";
import {
  formatListeningTranscript,
  formatPartTwoTranscript,
  formatTranslatedTranscript,
} from "../utils/reviewContent";
import { useLanguage } from "../../../i18n/LanguageContext";

const examErrorMessage = (error) => error instanceof AnswerSaveError ? "" : error.message;

const PRACTICE_FEEDBACK_SOUNDS = {
  correct: "/audio/correct.mp3",
  incorrect: "/audio/incorrect.mp3",
};

function SubmitDialog({ unansweredCount, submitting, practice, onCancel, onConfirm }) {
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
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
          {practice ? t("finishPractice") : t("submitTest")}
        </p>
        <h2 id="submit-title" className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
          {practice ? t("finishPracticeNow") : t("submitAnswersNow")}
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
            {submitting ? t("saving") : practice ? t("finishPractice") : t("submitTest")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListeningCompleteScreen({ attempt, answeredCount, unansweredCount, remainingSeconds, submitting, error, onSubmit, onExit }) {
  const { t } = useLanguage();
  return (
    <div translate="no" className="notranslate min-h-screen bg-slate-50 text-slate-900">
      <ExamHeader
        testId={attempt.testId}
        section="AWAITING_SUBMISSION"
        type={attempt.type}
        mode={attempt.mode}
        selectedPart={attempt.selectedPart}
        selectedParts={attempt.selectedParts}
        firstQuestion={attempt.firstQuestionNumber}
        lastQuestion={attempt.lastQuestionNumber}
        remainingSeconds={remainingSeconds ?? 0}
        timerType={attempt.timed === false ? TIMER_TYPES.UNTIMED : TIMER_TYPES.COUNTDOWN}
        onExit={onExit}
        exitDisabled={submitting}
      />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-5 py-10">
        <section className="w-full rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-xl shadow-emerald-100/70 sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</span>
          <h1 className="mt-5 text-2xl font-bold text-slate-950 sm:text-3xl">
            {t("listeningCompletedTitle")}
          </h1>
          <p className="mt-3 text-base text-slate-600">
            {t("answeredSummaryPrefix")} <strong className="text-slate-950">{answeredCount}/{attempt.totalQuestions}</strong> {t("questions")}.
          </p>
          {unansweredCount > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("unansweredWarningPrefix")} <strong>{unansweredCount} {t("unanswered").toLowerCase()}</strong>. {t("listeningAnswersLocked")}
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="mt-7 w-full rounded-xl bg-sky-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700 disabled:cursor-wait disabled:bg-sky-300 sm:w-auto sm:min-w-72"
          >
            {submitting
              ? t("saving")
              : attempt.type === "PRACTICE"
                ? t("finishPracticeAndViewResults")
                : t("submitAndViewResults")}
          </button>
        </section>
      </main>
    </div>
  );
}

function FullTestExam() {
  const { t } = useLanguage();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const seededAttempt = useRef(location.state?.attempt);
  const startupResume = useRef(null);
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [serverClock, setServerClock] = useState(null);
  const [clockSkew, setClockSkew] = useState(0);
  const [error, setError] = useState("");
  const [batchSaveState, setSaveState] = useState("Synced");
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [sectionNotice, setSectionNotice] = useState(false);
  const [audioAdvanceError, setAudioAdvanceError] = useState("");
  const [autosave, setAutosave] = useState({ pending: false, failed: [], saved: false });
  const [dismissedSaveError, setDismissedSaveError] = useState(null);
  const saveQueue = useMemo(() => createAnswerSaveQueue({
    write: (questionNumber, selectedAnswer) => apiFetch(`/api/attempts/${attemptId}/answers`, {
      method: "PUT",
      body: JSON.stringify({ questionNumber, selectedAnswer }),
    }),
    onChange: setAutosave,
  }), [attemptId]);
  const saveError = autosave.failed.at(-1)?.error;
  const saveState = saveError ? "Save failed"
    : autosave.pending ? "Saving..."
    : autosave.saved && batchSaveState === "Synced" ? "Autosaved" : batchSaveState;
  const answersRef = useRef({});
  const audioAdvanceInFlight = useRef(false);
  const submitInFlight = useRef(false);
  const hasSubmitted = useRef(false);
  const readingContentRef = useRef(null);
  const readingQuestionsRef = useRef(null);
  const nextMediaPreloadRef = useRef(null);
  const practiceFeedbackAudioRef = useRef(null);
  const practiceFeedbackAudioContextRef = useRef(null);
  const practiceSoundPendingUnitsRef = useRef(new Set());
  const [loadedListeningImageUrl, setLoadedListeningImageUrl] = useState(null);
  const [failedListeningImageUrl, setFailedListeningImageUrl] = useState(null);
  const [listeningImageRetryKey, setListeningImageRetryKey] = useState(0);
  const [practiceFeedbackByUnit, setPracticeFeedbackByUnit] = useState({});

  useEffect(() => {
    let active = true;
    const applyExam = (data, localEdits = {}) => {
      const serverNow = data.attempt.serverTime || Date.now();
      const nextAnswers = { ...data.attempt.answers, ...localEdits };
      setPayload(data);
      setAnswers(nextAnswers);
      answersRef.current = nextAnswers;
      setClockSkew(serverNow - Date.now());
      setServerClock(serverNow);
    };

    const seeded = seededAttempt.current;
    const cachedTest = seeded?.id === attemptId && seeded.serverTime && seeded.status === "IN_PROGRESS"
      ? recallExamTest(seeded.testId, seeded.selectedParts)
      : null;
    if (cachedTest && seeded) {
      applyExam({ attempt: seeded, test: cachedTest });
    }

    const answersAtLoad = answersRef.current;
    const loadExam = async () => {
      if (seeded?.id === attemptId && seeded.type === "PRACTICE" && seeded.status === "PAUSED") {
        startupResume.current ??= resumePracticeAttempt(attemptId);
        try {
          await startupResume.current;
        } catch {
          // The paused screen provides an explicit retry if automatic resume fails.
        }
      }
      return apiFetch(`/api/attempts/${attemptId}/exam`);
    };

    loadExam()
      .then((data) => {
        if (!active) return;
        rememberExamTest(data.test);
        const localEdits = cachedTest ? Object.fromEntries(
          Object.entries(answersRef.current).filter(([question, answer]) => answersAtLoad[question] !== answer),
        ) : {};
        applyExam(data, localEdits);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 409) {
          navigate(`/full-test/${attemptId}/result`, { replace: true });
          return;
        }
        setError(examErrorMessage(requestError));
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
  const timerType = getTimerType(attempt);
  const remainingSeconds = serverClock === null ? null : getDisplayTimerSeconds(attempt, serverClock);
  const currentQuestion = attempt?.currentQuestionNumber || 1;
  const awaitingListeningSubmission = attempt?.currentSection === "AWAITING_SUBMISSION";
  const currentUnits = attempt?.currentSection === "LISTENING" || awaitingListeningSubmission
    ? listeningUnits
    : readingUnits;
  const currentUnit = findUnit(currentUnits, currentQuestion);
  const isPractice = attempt?.type === "PRACTICE";
  const practiceQuestionStatuses = useMemo(() => {
    if (!isPractice) return undefined;
    return Object.fromEntries(Object.values(practiceFeedbackByUnit)
      .flatMap((feedback) => feedback.questions || [])
      .filter((question) => question.selectedAnswer
        && question.selectedAnswer === answers[question.questionNumber]
        && ["CORRECT", "INCORRECT"].includes(question.answerStatus))
      .map((question) => [question.questionNumber, question.answerStatus]));
  }, [answers, isPractice, practiceFeedbackByUnit]);

  const currentPracticeFeedback = currentUnit
    ? practiceFeedbackByUnit[currentUnit.key]
    : null;
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
    return buildNavigatorGroups([...listeningUnits, ...readingUnits]);
  }, [listeningUnits, readingUnits]);
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

  useEffect(() => () => {
    practiceFeedbackAudioRef.current?.pause();
    practiceFeedbackAudioRef.current = null;
    const player = practiceFeedbackAudioContextRef.current;
    practiceFeedbackAudioContextRef.current = null;
    if (player) {
      try {
        player.source?.stop();
      } catch {
        // The source may already have finished naturally.
      }
      player.context.close().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (attempt?.currentSection !== "READING" && !isPractice) return;
    readingQuestionsRef.current
      ?.querySelector(`#question-${currentQuestion}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [attempt?.currentSection, currentQuestion, isPractice]);

  useEffect(() => {
    if (!attempt?.sectionEndAt || attempt.status !== "IN_PROGRESS") return undefined;

    const updateClock = () => {
      const serverNow = Date.now() + clockSkew;
      setServerClock(serverNow);
    };
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [attempt, clockSkew]);

  useEffect(() => () => saveQueue.discard({ notify: false }), [saveQueue]);

  const saveAnswer = (questionNumber, selectedAnswer) => {
    answersRef.current = { ...answersRef.current, [questionNumber]: selectedAnswer };
    setAnswers((current) => ({ ...current, [questionNumber]: selectedAnswer }));
    return saveQueue.enqueue(questionNumber, selectedAnswer);
  };

  const { waitForPendingSaves } = saveQueue;

  const unlockPracticeFeedbackAudio = useCallback(() => {
    let player = practiceFeedbackAudioContextRef.current;
    if (!player) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;

      const context = new AudioContextClass();
      player = {
        context,
        buffers: {},
        source: null,
        loadPromise: null,
      };
      player.loadPromise = Promise.all(
        Object.entries(PRACTICE_FEEDBACK_SOUNDS).map(async ([name, url]) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Unable to load practice sound: ${url}`);
          player.buffers[name] = await context.decodeAudioData(await response.arrayBuffer());
        }),
      ).then(() => true).catch(() => false);
      practiceFeedbackAudioContextRef.current = player;
    }

    if (player.context.state === "suspended") {
      player.context.resume().catch(() => undefined);
    }
    return player;
  }, []);

  const playPracticeFeedbackSound = useCallback(async (feedback, unitKey) => {
    if (!practiceSoundPendingUnitsRef.current.has(unitKey)) return;
    practiceSoundPendingUnitsRef.current.delete(unitKey);

    const allCorrect = feedback.questions?.length > 0
      && feedback.questions.every((question) => question.answerStatus === "CORRECT");
    const soundName = allCorrect ? "correct" : "incorrect";
    const player = unlockPracticeFeedbackAudio();

    if (player && await player.loadPromise && player.context.state === "running") {
      try {
        player.source?.stop();
      } catch {
        // The source may already have finished naturally.
      }
      const source = player.context.createBufferSource();
      source.buffer = player.buffers[soundName];
      source.connect(player.context.destination);
      source.start();
      player.source = source;
      return;
    }

    practiceFeedbackAudioRef.current?.pause();
    const audio = new Audio(PRACTICE_FEEDBACK_SOUNDS[soundName]);
    practiceFeedbackAudioRef.current = audio;
    audio.play().catch(() => {
      // Keep visual feedback available if this older browser rejects audio.
    });
  }, [unlockPracticeFeedbackAudio]);

  useEffect(() => {
    if (!isPractice || attempt?.status !== "IN_PROGRESS" || !currentUnit || currentPracticeFeedback?.ready) return undefined;
    const unitIsAnswered = currentUnit.questions.every(
      (question) => answers[String(question.questionNumber)],
    );
    if (!unitIsAnswered) return undefined;

    let active = true;
    const loadFeedback = async () => {
      try {
        await waitForPendingSaves();
        const questionNumber = currentUnit.questions[0]?.questionNumber;
        if (!questionNumber) return;
        const feedback = await apiFetch(
          `/api/attempts/${attemptId}/practice-feedback?questionNumber=${questionNumber}`,
        );
        if (active && feedback.ready) {
          setPracticeFeedbackByUnit((current) => ({
            ...current,
            [currentUnit.key]: feedback,
          }));
          playPracticeFeedbackSound(feedback, currentUnit.key);
        }
      } catch (requestError) {
        if (active) setError(examErrorMessage(requestError));
      }
    };

    loadFeedback();
    return () => {
      active = false;
    };
  }, [
    answers,
    autosave.pending,
    attempt?.status,
    attemptId,
    currentPracticeFeedback?.ready,
    currentUnit,
    isPractice,
    playPracticeFeedbackSound,
    waitForPendingSaves,
  ]);

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
      setError(examErrorMessage(requestError));
      setBusy(false);
      setShowSubmit(false);
      return false;
    }
  }, [attemptId, navigate, saveCurrentAnswers, waitForPendingSaves]);

  const deadlineReached = attempt?.status === "IN_PROGRESS"
    && timerType === TIMER_TYPES.COUNTDOWN
    && serverClock !== null && getTimerSeconds(attempt, serverClock) === 0;

  useEffect(() => {
    if (!attempt || !deadlineReached || busy || hasSubmitted.current) return undefined;

    let active = true;
    let retryId;
    const controller = new AbortController();

    const syncExpiredAttempt = async () => {
      try {
        const nextAttempt = await apiFetch(`/api/attempts/${attemptId}`, {
          signal: controller.signal,
        });
        if (!active || hasSubmitted.current) return;

        if (nextAttempt.status === "COMPLETED") {
          hasSubmitted.current = true;
          navigate(`/full-test/${attemptId}/result`, { replace: true });
          return;
        }

        const serverNow = nextAttempt.serverTime ?? Date.now();
        setClockSkew(serverNow - Date.now());
        setServerClock(serverNow);
        setError("");
        const sectionChanged = nextAttempt.currentSection !== attempt.currentSection;
        if (sectionChanged || nextAttempt.status !== attempt.status) {
          saveQueue.discard();
          setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
          setAnswers(nextAttempt.answers || {});
          answersRef.current = nextAttempt.answers || {};
          setShowSubmit(false);
          setSectionNotice(sectionChanged && nextAttempt.currentSection === "READING");
        } else if (getTimerSeconds(nextAttempt, serverNow) === 0) {
          retryId = window.setTimeout(syncExpiredAttempt, 1000);
        }
      } catch (requestError) {
        if (!active) return;
        setError(examErrorMessage(requestError));
        if (!(requestError instanceof ApiError) || requestError.status >= 500 || requestError.status === 429) {
          retryId = window.setTimeout(syncExpiredAttempt, 3000);
        }
      }
    };

    syncExpiredAttempt();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(retryId);
    };
  }, [attempt, attemptId, busy, deadlineReached, navigate, saveQueue]);

  const advanceListeningAfterAudio = async () => {
    if (!currentUnit || busy || deadlineReached || audioAdvanceInFlight.current) return;
    audioAdvanceInFlight.current = true;
    setBusy(true);
    setError("");
    setAudioAdvanceError("");
    try {
      let nextAttempt = audioAdvanceError ? await apiFetch(`/api/attempts/${attemptId}`) : null;
      const stillOnCurrentUnit = nextAttempt?.status === "IN_PROGRESS"
        && nextAttempt.currentSection === "LISTENING"
        && nextAttempt.currentQuestionNumber === attempt.currentQuestionNumber;
      if (!nextAttempt || stillOnCurrentUnit) {
        await saveCurrentAnswers();
        nextAttempt = await apiFetch(`/api/attempts/${attemptId}/listening/next`, {
          method: "POST",
        });
      }
      if (nextAttempt.status === "COMPLETED") {
        hasSubmitted.current = true;
        navigate(`/full-test/${attemptId}/result`, { replace: true });
        return;
      }
      setAudioAdvanceError("");
      const serverNow = nextAttempt.serverTime ?? Date.now();
      setClockSkew(serverNow - Date.now());
      setServerClock(serverNow);
      setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
      setAnswers(nextAttempt.answers || answersRef.current);
      answersRef.current = nextAttempt.answers || answersRef.current;
      if (nextAttempt.currentSection === "READING") {
        setSectionNotice(true);
      }
      setSaveState("Autosaved");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(examErrorMessage(requestError));
      setAudioAdvanceError(t("autoAdvanceFailed"));
      audioAdvanceInFlight.current = false;
    } finally {
      setBusy(false);
    }
  };

  const moveToQuestion = async (questionNumber) => {
    if (busy || deadlineReached || !scopeQuestionNumbers.includes(questionNumber)
      || (!isPractice && questionNumber < 101)) return;
    setBusy(true);
    setError("");
    try {
      await waitForPendingSaves();
      const nextAttempt = await apiFetch(`/api/attempts/${attemptId}/position`, {
        method: "PUT",
        body: JSON.stringify({ questionNumber }),
      });
      if (nextAttempt.status === "COMPLETED") {
        navigate(`/full-test/${attemptId}/result`, { replace: true });
        return;
      }
      const serverNow = nextAttempt.serverTime ?? Date.now();
      setClockSkew(serverNow - Date.now());
      setServerClock(serverNow);
      setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
      const nextAnswers = nextAttempt.answers ?? answersRef.current;
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(examErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const exitExam = async () => {
    if (busy || deadlineReached) return;
    const message = !isPractice ? "discardMockConfirm"
      : attempt.timed ? "pauseTimedPracticeConfirm" : "practiceExitConfirm";
    if (!window.confirm(t(message))) return;

    const exitPath = isPractice ? "/history" : "/tests";
    saveQueue.cancelRetries();
    setBusy(true);
    setError("");
    try {
      if (isPractice) {
        await waitForPendingSaves();
        if (timerType === TIMER_TYPES.UNTIMED) {
          navigate(exitPath, { replace: true });
          return;
        }
      } else {
        await saveQueue.drain();
      }
      const exited = await exitAttempt(attemptId);
      if (exited.status === "COMPLETED") {
        navigate(`/full-test/${attemptId}/result`, { replace: true });
      } else {
        navigate(exitPath, { replace: true });
      }
    } catch (requestError) {
      if (!isPractice && requestError instanceof ApiError && requestError.status === 404) {
        navigate(exitPath, { replace: true });
      } else {
        setError(examErrorMessage(requestError));
      }
    } finally {
      setBusy(false);
    }
  };

  const resumePausedPractice = async () => {
    setBusy(true);
    setError("");
    try {
      saveQueue.discard();
      await saveQueue.drain();
      const resumed = await resumePracticeAttempt(attemptId);
      if (resumed.status === "COMPLETED") {
        navigate(`/full-test/${attemptId}/result`, { replace: true });
        return;
      }
      const serverNow = resumed.serverTime ?? Date.now();
      setClockSkew(serverNow - Date.now());
      setServerClock(serverNow);
      setAnswers(resumed.answers || {});
      answersRef.current = resumed.answers || {};
      setPayload((previous) => ({ ...previous, attempt: resumed }));
    } catch (requestError) {
      setError(examErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
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

  if (attempt?.status === "PAUSED") {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-md rounded-2xl border bg-white p-6">
          <h1 className="text-xl font-bold">{t("practicePaused")}</h1>
          <p className="mt-2">{t("practiceTimeLeft").replace("{time}", formatClock(attempt.pausedRemainingSeconds ?? 0))}</p>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={resumePausedPractice} className="rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{t("continue")}</button>
            <button type="button" disabled={busy} onClick={() => navigate("/history", { replace: true })} className="rounded-xl border px-4 py-2 font-semibold">{t("cancel")}</button>
          </div>
        </section>
      </main>
    );
  }

  if (payload && awaitingListeningSubmission) {
    return (
      <ListeningCompleteScreen
        attempt={attempt}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        remainingSeconds={remainingSeconds}
        error={error}
        submitting={busy || deadlineReached}
        onSubmit={() => submitExamOnce({ saveCurrent: false })}
        onExit={exitExam}
      />
    );
  }

  if (!payload || !currentUnit) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">{t("restoringTest")}</div>;
  }

  const isListening = attempt.currentSection === "LISTENING";
  const navigableQuestions = isPractice
    ? scopeQuestionNumbers
    : scopeQuestionNumbers.filter((number) => number >= 101);
  const questionIndex = navigableQuestions.indexOf(currentQuestion);
  const previousQuestion = navigableQuestions[questionIndex - 1];
  const nextQuestion = navigableQuestions[questionIndex + 1];
  const listeningLocked = isListening && !isPractice;
  const mediaImage = currentUnit.imageUrl;
  const mediaAudio = currentUnit.audioUrl;
  const practiceFeedbackQuestions = new Map(
    (currentPracticeFeedback?.questions || []).map((question) => [
      question.questionNumber,
      question,
    ]),
  );
  const selectAnswer = (questionNumber, answer) => {
    if (isPractice) {
      unlockPracticeFeedbackAudio();
      practiceSoundPendingUnitsRef.current.add(currentUnit.key);
    }
    saveAnswer(questionNumber, answer).catch(() => undefined);
  };

  const selectAnswerByShortcut = (optionIndex, focusedRadioName) => {
    const questions = currentUnit.questions.filter(
      (question) => !practiceFeedbackQuestions.has(question.questionNumber),
    );
    const question = focusedRadioName
      ? questions.find((item) => focusedRadioName === `question-${item.questionNumber}`)
      : questions.find((item) => !answersRef.current[item.questionNumber]) ?? questions[0];
    const answer = question?.answers?.[optionIndex];
    if (!answer) return false;

    if (answersRef.current[question.questionNumber] !== answer.label) {
      selectAnswer(question.questionNumber, answer.label);
    }
    return true;
  };

  const firstPracticeFeedbackQuestion = currentPracticeFeedback?.questions?.[0];
  const practiceTranscript = currentUnit.partNumber === 2
    ? firstPracticeFeedbackQuestion?.transcript
    : [3, 4].includes(currentUnit.partNumber)
      ? currentPracticeFeedback?.transcript
      : null;
  const formattedPracticeTranscript = currentUnit.partNumber === 2
    ? formatPartTwoTranscript(practiceTranscript)
    : formatListeningTranscript(practiceTranscript, currentUnit.partNumber);
  const practiceTranscriptTranslation = currentUnit.partNumber === 2
    ? formatTranslatedTranscript(
      firstPracticeFeedbackQuestion?.questionTranslation,
      firstPracticeFeedbackQuestion?.answerTranslation,
    )
    : [3, 4].includes(currentUnit.partNumber)
      ? currentPracticeFeedback?.transcriptTranslation
      : null;
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
    <div translate="no" className="notranslate min-h-screen bg-slate-50 text-slate-900">
      <ExamHeader
        testId={payload.test?.testId || attempt.testId}
        section={attempt.currentSection}
        type={attempt.type}
        mode={attempt.mode}
        selectedPart={attempt.selectedPart}
        selectedParts={attempt.selectedParts}
        currentPart={{ number: currentUnit.partNumber, name: currentUnit.partName }}
        remainingSeconds={remainingSeconds ?? 0}
        timerType={timerType}
        onExit={exitExam}
        exitDisabled={busy || deadlineReached}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500">
          <span role="status" className="inline-flex items-center gap-2">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${saveState === "Save failed" ? "bg-red-500" : saveState === "Saving..." ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
            {saveState === "Save failed" ? t("saveFailed") : saveState === "Saving..." ? t("saving") : saveState === "Synced" ? t("synced") : t("autosaved")}
          </span>
          {saveError && !autosave.pending && !deadlineReached && (
            <button type="button" disabled={busy} onClick={() => saveQueue.retryFailed()} className="font-semibold text-sky-700 underline disabled:opacity-50">
              {t("retrySavingAnswers")}
            </button>
          )}
        </div>
      </ExamHeader>

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
        {saveError && dismissedSaveError !== saveError && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{t("answerSaveError")}</span>
            <button type="button" onClick={() => setDismissedSaveError(saveError)} aria-label={t("dismiss")} className="font-bold">×</button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        <div className="w-full">
          <section className="min-w-0 space-y-3">
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
                      {mediaAudio && isPractice && (
                        <PracticeAudioPlayer
                          key={`${currentUnit.key}:${mediaAudio}`}
                          src={mediaAudio}
                          paused={showSubmit || deadlineReached || busy}
                          shortcutsDisabled={showNavigator}
                          onAnswerShortcut={selectAnswerByShortcut}
                        />
                      )}
                      {mediaAudio && !isPractice && (
                        <LockedExamAudio
                          key={currentUnit.key}
                          src={mediaAudio}
                          advancing={busy}
                          paused={showSubmit || deadlineReached || busy}
                          ready={listeningImageReady}
                          onEnded={advanceListeningAfterAudio}
                          onSkip={advanceListeningAfterAudio}
                        />
                      )}
                      {!mediaAudio && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                          {isPractice ? t("practiceMissingAudio") : t("missingAudio")}
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
                              {!isPractice && mediaAudio && (
                                <button
                                  type="button"
                                  onClick={advanceListeningAfterAudio}
                                  disabled={busy || deadlineReached}
                                  className="rounded-xl bg-white px-4 py-2 font-bold text-red-700 ring-1 ring-red-100 disabled:opacity-50"
                                >
                                  {t("skipUnavailableListeningUnit")}
                                </button>
                              )}
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

                      {currentPracticeFeedback?.ready && formattedPracticeTranscript && (
                        <ReviewTogglePanel title={t("transcript")} icon="▤" tone="sky">
                          <p className="whitespace-pre-wrap">{formattedPracticeTranscript}</p>
                        </ReviewTogglePanel>
                      )}

                      {currentPracticeFeedback?.ready && practiceTranscriptTranslation && (
                        <ReviewTogglePanel title={t("transcriptTranslation")} icon="文" tone="sky">
                          <p className="whitespace-pre-wrap">{practiceTranscriptTranslation}</p>
                        </ReviewTogglePanel>
                      )}
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
                      {currentUnit.questions.map((question) => {
                        const feedbackQuestion = practiceFeedbackQuestions.get(
                          question.questionNumber,
                        );
                        const feedbackVisible = Boolean(feedbackQuestion);
                        return (
                          <div key={question.questionNumber}>
                            {autosave.failed.some((entry) => entry.questionNumber === question.questionNumber) && (
                              <p className="mb-1 text-xs font-semibold text-red-700">{t("answerNotSaved")}</p>
                            )}
                            <QuestionCard
                              question={feedbackQuestion || question}
                              selectedAnswer={answers[String(question.questionNumber)] || null}
                              onSelect={(answer) => selectAnswer(question.questionNumber, answer)}
                              disabled={feedbackVisible || busy || deadlineReached}
                              hideOptionContent={isListening
                                && currentUnit.partNumber <= 2
                                && !feedbackVisible}
                              isFocused={question.questionNumber === currentQuestion}
                              compact
                              review={feedbackVisible}
                              hideReviewTranslations={[1, 2].includes(currentUnit.partNumber)}
                              translatedTranscript={currentUnit.partNumber === 1 && feedbackVisible
                                ? formatTranslatedTranscript(
                                  feedbackQuestion.questionTranslation,
                                  feedbackQuestion.answerTranslation,
                                )
                                : null}
                              hideDetailedExplanation={[1, 2].includes(currentUnit.partNumber)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <ExamNavigationBar
                    progressLabel={progressLabel}
                    onOpenNavigator={() => setShowNavigator(true)}
                    onPrevious={() => moveToQuestion(previousQuestion)}
                    onNext={listeningLocked
                      ? advanceListeningAfterAudio
                      : () => moveToQuestion(nextQuestion)}
                    onSubmit={() => setShowSubmit(true)}
                    submitLabel={isPractice ? t("finishPractice") : t("submitTest")}
                    previousDisabled={busy || deadlineReached || listeningLocked || previousQuestion === undefined}
                    nextDisabled={busy || deadlineReached || (listeningLocked
                      ? Boolean(mediaAudio) && !audioAdvanceError
                      : nextQuestion === undefined)}
                    submitDisabled={shouldDisableSubmit(attempt, busy || deadlineReached)}
                    previousTitle={listeningLocked ? t("listeningLocked") : undefined}
                    nextTitle={listeningLocked && mediaAudio && !audioAdvanceError
                      ? t("nextGroupAuto")
                      : undefined}
                    statusMessage={listeningLocked
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

      {showSubmit && !deadlineReached && (
        <SubmitDialog
          unansweredCount={unansweredCount}
          submitting={busy}
          practice={isPractice}
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
        navigationLocked={listeningLocked}
        questionStatuses={practiceQuestionStatuses}
        practiceMode={isPractice}
        isQuestionDisabled={(number) => busy || deadlineReached || (!isPractice && number < 101)}
        onSelect={listeningLocked ? null : moveToQuestion}
      />
    </div>
  );
}

export default FullTestExam;
