import { formatClock } from "../utils/testData";
import { TIMER_TYPES } from "../config/examTiming";

function ExamHeader({
  section,
  mode,
  selectedPart,
  selectedParts,
  firstQuestion,
  lastQuestion,
  remainingSeconds,
  timerType,
  answeredCount,
  totalQuestions,
  onExit,
}) {
  const isElapsed = timerType === TIMER_TYPES.ELAPSED;
  const isUrgent = !isElapsed && remainingSeconds <= 300;
  const modeLabel =
    mode === "FULL"
      ? "Full Test"
      : mode === "PART"
        ? `Part ${(selectedParts?.length ? selectedParts : [selectedPart]).filter(Boolean).join(" + ")}`
        : mode === "LISTENING"
          ? "Thi Listening"
          : "Thi Reading";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-sm font-bold text-white">
            TP
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">ETS 2026 · Test 1 · {modeLabel}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
              {section === "LISTENING" ? "Listening" : "Reading"} · Câu {firstQuestion}–{lastQuestion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-slate-500">Đã trả lời</p>
            <p className="text-sm font-bold text-slate-900">{answeredCount}/{totalQuestions}</p>
          </div>
          <div
            className={`rounded-xl px-4 py-2 text-center ${
              isUrgent ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-900 text-white"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
              {isElapsed ? "Thời gian làm bài" : "Còn lại"}
            </p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {formatClock(remainingSeconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:px-4 sm:text-sm"
          >
            Thoát
          </button>
        </div>
      </div>
    </header>
  );
}

export default ExamHeader;
