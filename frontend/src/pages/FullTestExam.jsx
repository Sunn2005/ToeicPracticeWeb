import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import ExamHeader from "../components/ExamHeader";
import LockedExamAudio from "../components/LockedExamAudio";
import PassagePanel from "../components/PassagePanel";
import QuestionCard from "../components/QuestionCard";
import ResizableExamLayout from "../components/ResizableExamLayout";
import {
  TIMER_TYPES,
  getTimerSeconds,
  getTimerType,
  shouldSubmitAfterListeningAudio,
} from "../config/examTiming";
import {
  buildListeningUnits,
  buildReadingUnits,
  findUnit,
} from "../utils/testData";

function secondsUntil(endAt, serverNow) {
  return Math.max(0, Math.ceil((endAt - serverNow) / 1000));
}

function SubmitDialog({ unansweredCount, submitting, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Xác nhận nộp bài</p>
        <h2 id="submit-title" className="mt-2 text-2xl font-bold text-slate-950">
          Bạn chắc chắn muốn nộp?
        </h2>
        <p className="mt-4 leading-7 text-slate-600">
          Bạn còn <strong className="text-amber-700">{unansweredCount} câu chưa trả lời</strong>.
          Sau khi nộp, toàn bộ đáp án sẽ bị khóa và không thể thay đổi.
        </p>
        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Tiếp tục làm
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white hover:bg-sky-600 disabled:bg-sky-300"
          >
            {submitting ? "Đang nộp..." : "Nộp bài"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FullTestExam() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [sectionRemainingSeconds, setSectionRemainingSeconds] = useState(null);
  const [clockSkew, setClockSkew] = useState(0);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Đã đồng bộ");
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
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
  const totalQuestions = attempt?.totalQuestions || scopeLast - scopeFirst + 1;
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
    setSaveState("Đang lưu...");

    const previousSave = pendingSaves.current.get(questionNumber) || Promise.resolve();
    const savePromise = previousSave
      .catch(() => undefined)
      .then(() => apiFetch(`/api/attempts/${attemptId}/answers`, {
        method: "PUT",
        body: JSON.stringify({ questionNumber, selectedAnswer }),
      }))
      .then(() => {
        setSaveState("Đã lưu tự động");
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
        setSaveState("Lưu thất bại");
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

  const saveCurrentAnswers = useCallback(async () => {
    if (!currentUnit) return;
    await waitForPendingSaves();
    setSaveState("Đang lưu...");
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
    setSaveState("Đã lưu tự động");
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
            "Đáp án đã được lưu nhưng chưa thể nộp bài. Hãy kiểm tra mạng rồi thử lại.",
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
      setSaveState("Đã lưu tự động");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
      setAudioAdvanceError(
        "Không thể lưu để tự chuyển. Hãy kiểm tra mạng rồi thử lại.",
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
      "Đáp án đã lưu sẽ được giữ lại và đồng hồ vẫn tiếp tục chạy. Bạn muốn về Dashboard?",
    );
    if (shouldExit) navigate("/dashboard");
  };

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-bold">Không mở được bài thi</p>
          <p className="mt-2 text-sm leading-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mt-5 rounded-xl bg-white px-4 py-2 font-semibold text-slate-700"
          >
            Về Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!payload || !currentUnit) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50">Đang khôi phục bài thi...</div>;
  }

  const isListening = attempt.currentSection === "LISTENING";
  const readingStart = Math.max(101, scopeFirst);
  const readingEnd = scopeLast;
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
  const selectedReadingParts = (selectedParts || [5, 6, 7])
    .filter((part) => part >= 5);
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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <ExamHeader
        section={attempt.currentSection}
        mode={attempt.mode}
        selectedPart={attempt.selectedPart}
        selectedParts={attempt.selectedParts}
        firstQuestion={scopeFirst}
        lastQuestion={scopeLast}
        remainingSeconds={remainingSeconds ?? 0}
        timerType={timerType}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        onExit={exitExam}
      />

      {sectionNotice && attempt.currentSection === "READING" && (
        <div className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-2xl">
          <p className="font-bold text-emerald-700">Listening đã kết thúc</p>
          <p className="mt-1 text-sm text-slate-600">
            {attempt.mode === "PART"
              ? "Bắt đầu các Part Reading · đồng hồ chung tiếp tục đếm"
              : "Bắt đầu phần Reading · 75 phút"}
          </p>
          <button
            type="button"
            onClick={() => setSectionNotice(false)}
            className="mt-4 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            Tiếp tục
          </button>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} className="font-bold">×</button>
          </div>
        )}

        <div className={isListening ? "mx-auto max-w-5xl" : "mx-auto max-w-[1500px]"}>
          <section className="min-w-0 space-y-5">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-600">
                  Part {currentUnit.partNumber} · {currentUnit.partName}
                </p>
                <h1 className="mt-1 text-xl font-bold">
                  {isListening
                    ? `Câu ${currentUnit.start}${currentUnit.end !== currentUnit.start ? `–${currentUnit.end}` : ""}`
                    : `Câu ${currentQuestion} · phạm vi ${scopeFirst}–${scopeLast}`}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${saveState === "Lưu thất bại" ? "bg-red-500" : saveState === "Đang lưu..." ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
                {saveState}
              </div>
            </div>

            <ResizableExamLayout
              leftLabel={isListening ? "nội dung bài nghe" : "nội dung bài đọc"}
              rightLabel="câu hỏi và đáp án"
              left={(
                <section
                  ref={readingContentRef}
                  aria-label={isListening ? "Nội dung bài nghe" : "Nội dung bài đọc"}
                  className="min-w-0 space-y-4 xl:h-[calc(100dvh-14rem)] xl:overflow-y-auto xl:pr-1"
                >
                  <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
                      {isListening ? "Nội dung bài nghe" : "Nội dung bài đọc"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isListening
                        ? "Nghe audio, xem hình minh họa (nếu có) và chọn đáp án ở cột bên phải."
                        : "Đọc nội dung bên trái và chọn đáp án ở cột bên phải."}
                    </p>
                  </div>

                  {isListening ? (
                    <>
                      {mediaAudio ? (
                        <LockedExamAudio
                          key={currentUnit.key}
                          src={mediaAudio}
                          advancing={busy}
                          onEnded={advanceListeningAfterAudio}
                        />
                      ) : (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                          Câu hoặc group này chưa có audioUrl nên hệ thống không thể tự chuyển.
                        </div>
                      )}

                      {mediaImage && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                          <img
                            src={mediaImage}
                            alt={`Hình minh họa cho câu ${currentUnit.start} đến ${currentUnit.end}`}
                            className="mx-auto h-auto max-h-[65vh] max-w-full rounded-xl object-contain"
                          />
                        </div>
                      )}

                      <PassagePanel passages={currentUnit.passages || []} />
                    </>
                  ) : (
                    <>
                      {shouldRenderStandaloneReadingImage && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                          <img
                            src={mediaImage}
                            alt={`Nội dung câu ${currentUnit.start}`}
                            className="mx-auto h-auto w-full rounded-xl object-contain"
                          />
                        </div>
                      )}

                      <PassagePanel
                        passages={currentUnit.passages || []}
                        imageUrls={currentUnit.imageUrls || []}
                      />

                      {!hasReadingMaterial && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
                          Part này không có đoạn văn riêng. Hãy chọn đáp án cho câu hỏi ở bên phải.
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}
              right={(
                <section
                  aria-label="Câu hỏi và đáp án"
                  className="min-w-0 xl:flex xl:h-[calc(100dvh-14rem)] xl:flex-col xl:pl-1"
                >
                  <div
                    ref={readingQuestionsRef}
                    className="min-w-0 space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1"
                  >
                    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-sky-600">
                            Câu hỏi & đáp án
                          </p>
                          <h2 className="mt-1 font-bold">
                            {isListening
                              ? `Part ${currentUnit.partNumber} · Câu ${currentUnit.start}–${currentUnit.end}`
                              : selectedReadingParts.map((part) => `Part ${part}`).join(" + ")}
                          </h2>
                        </div>
                        {!isListening && (
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                            {Object.entries(answers).filter(
                              ([number, value]) => Number(number) >= readingStart
                                && Number(number) <= readingEnd
                                && value,
                            ).length}/{readingQuestionNumbers.length}
                          </span>
                        )}
                      </div>

                      {!isListening && (
                        <div className="mt-4 grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                          {readingQuestionNumbers.map((number) => {
                            const isAnswered = Boolean(answers[String(number)]);
                            const isCurrent = number === currentQuestion;
                            return (
                              <button
                                key={number}
                                type="button"
                                onClick={() => moveReading(number)}
                                disabled={busy}
                                aria-label={`Đến câu ${number}`}
                                className={`aspect-square rounded-lg text-[11px] font-bold transition ${
                                  isCurrent
                                    ? "bg-sky-600 text-white ring-2 ring-sky-200"
                                    : isAnswered
                                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                              >
                                {number}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </aside>

                    <div className="space-y-4 pb-4">
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
                        />
                      ))}
                    </div>
                  </div>

                  <footer className="sticky bottom-3 z-10 mt-4 shrink-0 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
                    {isListening ? (
                      <div className="text-center">
                        {audioAdvanceError ? (
                          <button
                            type="button"
                            onClick={advanceListeningAfterAudio}
                            disabled={busy}
                            className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            {shouldSubmitAfterListeningAudio(attempt, currentUnit, listeningUnits)
                              ? "Thử lưu và nộp lại"
                              : "Thử lưu và tự chuyển lại"}
                          </button>
                        ) : (
                          <p className="text-sm font-medium text-slate-500">
                            Audio kết thúc sẽ tự động lưu {currentUnit.questions.length > 1 ? "cả group" : "đáp án"}
                            {shouldSubmitAfterListeningAudio(attempt, currentUnit, listeningUnits)
                              ? " và nộp bài."
                              : " và chuyển tiếp."}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => moveReading(previousReadingQuestion)}
                          disabled={previousReadingQuestion === null || busy}
                          className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                          ← Câu trước
                        </button>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowSubmit(true)}
                            className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-bold text-red-700 hover:bg-red-100"
                          >
                            Nộp bài
                          </button>
                          <button
                            type="button"
                            onClick={() => moveReading(nextReadingQuestion)}
                            disabled={nextReadingQuestion === null || busy}
                            className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white hover:bg-sky-600 disabled:opacity-40"
                          >
                            Câu tiếp →
                          </button>
                        </div>
                      </div>
                    )}
                  </footer>
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
    </div>
  );
}

export default FullTestExam;
