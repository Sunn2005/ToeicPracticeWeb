import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import ExamHeader from "../components/ExamHeader";
import PassagePanel from "../components/PassagePanel";
import QuestionCard from "../components/QuestionCard";
import {
  buildListeningUnits,
  buildReadingUnits,
  findUnit,
} from "../utils/testData";

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
  const [clockSkew, setClockSkew] = useState(0);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("Đã đồng bộ");
  const [busy, setBusy] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [sectionNotice, setSectionNotice] = useState(false);
  const pendingSaves = useRef(new Map());
  const timeoutHandled = useRef(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/attempts/${attemptId}/exam`)
      .then((data) => {
        if (!active) return;
        const serverNow = data.attempt.serverTime || Date.now();
        setPayload(data);
        setAnswers(data.attempt.answers || {});
        setClockSkew(serverNow - Date.now());
        setRemainingSeconds(
          Math.max(0, Math.ceil((data.attempt.sectionEndAt - serverNow) / 1000)),
        );
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

  const listeningUnits = useMemo(
    () => buildListeningUnits(payload?.test),
    [payload?.test],
  );
  const readingUnits = useMemo(
    () => buildReadingUnits(payload?.test),
    [payload?.test],
  );

  const attempt = payload?.attempt;
  const currentQuestion = attempt?.currentQuestionNumber || 1;
  const currentUnits = attempt?.currentSection === "LISTENING" ? listeningUnits : readingUnits;
  const currentUnit = findUnit(currentUnits, currentQuestion);
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const unansweredCount = 200 - answeredCount;

  useEffect(() => {
    if (!attempt?.sectionEndAt) return undefined;

    const updateClock = () => {
      const serverNow = Date.now() + clockSkew;
      setRemainingSeconds(Math.max(0, Math.ceil((attempt.sectionEndAt - serverNow) / 1000)));
    };
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [attempt?.sectionEndAt, clockSkew]);

  useEffect(() => {
    if (
      !attempt ||
      remainingSeconds === null ||
      remainingSeconds > 0 ||
      timeoutHandled.current
    ) return;
    timeoutHandled.current = true;

    const handleTimeout = async () => {
      try {
        if (attempt.currentSection === "LISTENING") {
          const nextAttempt = await apiFetch(
            `/api/attempts/${attemptId}/finish-listening`,
            { method: "POST" },
          );
          const serverNow = nextAttempt.serverTime || Date.now();
          setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
          setAnswers(nextAttempt.answers || {});
          setClockSkew(serverNow - Date.now());
          setRemainingSeconds(
            Math.max(0, Math.ceil((nextAttempt.sectionEndAt - serverNow) / 1000)),
          );
          setSectionNotice(true);
          timeoutHandled.current = false;
        } else {
          await apiFetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
          navigate(`/full-test/${attemptId}/result`, { replace: true });
        }
      } catch (requestError) {
        setError(requestError.message);
        timeoutHandled.current = false;
      }
    };

    handleTimeout();
  }, [attempt, attemptId, navigate, remainingSeconds]);

  const saveAnswer = (questionNumber, selectedAnswer) => {
    const previousAnswer = answers[String(questionNumber)] ?? null;
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

  const waitForPendingSaves = async () => {
    const saves = [...pendingSaves.current.values()];
    if (saves.length) await Promise.all(saves);
  };

  const handleListeningNext = async () => {
    if (!currentUnit || busy) return;
    setBusy(true);
    setError("");
    try {
      await waitForPendingSaves();
      await Promise.all(
        currentUnit.questions.map((question) =>
          apiFetch(`/api/attempts/${attemptId}/answers`, {
            method: "PUT",
            body: JSON.stringify({
              questionNumber: question.questionNumber,
              selectedAnswer: answers[String(question.questionNumber)] || null,
            }),
          }),
        ),
      );
      const nextAttempt = await apiFetch(
        `/api/attempts/${attemptId}/listening/next`,
        { method: "POST" },
      );
      setPayload((previous) => ({ ...previous, attempt: nextAttempt }));
      setAnswers(nextAttempt.answers || answers);
      if (attempt.currentSection === "LISTENING" && nextAttempt.currentSection === "READING") {
        setSectionNotice(true);
      }
      setSaveState("Đã lưu tự động");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const moveReading = async (questionNumber) => {
    if (questionNumber < 101 || questionNumber > 200 || busy) return;
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

  const submitTest = async () => {
    setBusy(true);
    setError("");
    try {
      await waitForPendingSaves();
      await apiFetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      navigate(`/full-test/${attemptId}/result`, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
      setShowSubmit(false);
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
  const mediaImage = currentUnit.imageUrl;
  const mediaAudio = currentUnit.audioUrl;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <ExamHeader
        section={attempt.currentSection}
        remainingSeconds={remainingSeconds ?? 0}
        answeredCount={answeredCount}
        onExit={exitExam}
      />

      {sectionNotice && attempt.currentSection === "READING" && (
        <div className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-2xl">
          <p className="font-bold text-emerald-700">Listening đã kết thúc</p>
          <p className="mt-1 text-sm text-slate-600">Bắt đầu phần Reading · 75 phút</p>
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

        <div className={isListening ? "mx-auto max-w-5xl" : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"}>
          <section className="min-w-0 space-y-5">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-600">
                  Part {currentUnit.partNumber} · {currentUnit.partName}
                </p>
                <h1 className="mt-1 text-xl font-bold">
                  {isListening
                    ? `Câu ${currentUnit.start}${currentUnit.end !== currentUnit.start ? `–${currentUnit.end}` : ""}`
                    : `Câu ${currentQuestion} / 200`}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${saveState === "Lưu thất bại" ? "bg-red-500" : saveState === "Đang lưu..." ? "animate-pulse bg-amber-400" : "bg-emerald-500"}`} />
                {saveState}
              </div>
            </div>

            {mediaAudio && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
                <p className="mb-3 text-sm font-semibold text-sky-800">
                  Audio Listening {isListening ? "· Không thể quay lại sau khi bấm Tiếp theo" : ""}
                </p>
                <audio key={mediaAudio} src={mediaAudio} controls autoPlay className="w-full" />
              </div>
            )}

            {mediaImage && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <img
                  src={mediaImage}
                  alt={`Hình minh họa câu ${currentUnit.start}`}
                  className="mx-auto max-h-[520px] max-w-full rounded-xl object-contain"
                />
              </div>
            )}

            <PassagePanel passages={currentUnit.passages || []} />

            <div className="space-y-4">
              {currentUnit.questions.map((question) => (
                <QuestionCard
                  key={question.questionNumber}
                  question={question}
                  selectedAnswer={answers[String(question.questionNumber)] || null}
                  onSelect={(answer) => {
                    saveAnswer(question.questionNumber, answer).catch(() => undefined);
                  }}
                  hideOptionContent={isListening && currentUnit.partNumber <= 2}
                  isFocused={question.questionNumber === currentQuestion}
                />
              ))}
            </div>

            {isListening ? (
              <div className="flex justify-end pb-8">
                <button
                  type="button"
                  onClick={handleListeningNext}
                  disabled={busy}
                  className="rounded-xl bg-sky-500 px-7 py-3.5 font-bold text-white shadow-lg shadow-sky-200 hover:bg-sky-600 disabled:cursor-wait disabled:bg-sky-300"
                >
                  {busy ? "Đang lưu..." : currentUnit.end === 100 ? "Sang phần Reading →" : "Lưu và tiếp theo →"}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pb-8">
                <button
                  type="button"
                  onClick={() => moveReading(currentQuestion - 1)}
                  disabled={currentQuestion <= 101 || busy}
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
                    onClick={() => moveReading(currentQuestion + 1)}
                    disabled={currentQuestion >= 200 || busy}
                    className="rounded-xl bg-sky-500 px-5 py-3 font-bold text-white hover:bg-sky-600 disabled:opacity-40"
                  >
                    Câu tiếp →
                  </button>
                </div>
              </div>
            )}
          </section>

          {!isListening && (
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Bảng câu hỏi</p>
                  <h2 className="mt-1 font-bold">Reading 101–200</h2>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                  {Object.entries(answers).filter(([number, value]) => Number(number) >= 101 && value).length}/100
                </span>
              </div>

              <div className="mt-5 grid grid-cols-10 gap-1.5 xl:grid-cols-5">
                {Array.from({ length: 100 }, (_, index) => index + 101).map((number) => {
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

              <div className="mt-5 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-emerald-100" /> Đã trả lời</span>
                <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-slate-100" /> Chưa trả lời</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const firstUnanswered = Array.from({ length: 100 }, (_, index) => index + 101).find(
                    (number) => !answers[String(number)],
                  );
                  if (firstUnanswered) moveReading(firstUnanswered);
                }}
                className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đến câu chưa trả lời
              </button>
            </aside>
          )}
        </div>
      </main>

      {showSubmit && (
        <SubmitDialog
          unansweredCount={unansweredCount}
          submitting={busy}
          onCancel={() => setShowSubmit(false)}
          onConfirm={submitTest}
        />
      )}
    </div>
  );
}

export default FullTestExam;
