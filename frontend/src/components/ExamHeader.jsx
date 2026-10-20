import { formatClock } from "../utils/testData";
import { TIMER_TYPES } from "../config/examTiming";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import { getTestName } from "../data/testCatalog";

function ExamHeader({
  testId,
  section,
  type,
  mode,
  selectedPart,
  selectedParts,
  firstQuestion,
  lastQuestion,
  remainingSeconds,
  timerType,
  onExit,
}) {
  const { t } = useLanguage();
  const isElapsed = timerType === TIMER_TYPES.ELAPSED;
  const isUntimed = timerType === TIMER_TYPES.UNTIMED;
  const isUrgent = !isElapsed && !isUntimed && remainingSeconds <= 300;
  const scopedParts = (selectedParts?.length ? selectedParts : [selectedPart])
    .filter(Boolean)
    .join(" + ");
  const attemptModeLabel = mode === "FULL"
    ? t("fullTest")
    : mode === "PART"
      ? `${t("part")} ${scopedParts}`
      : mode === "LISTENING"
        ? t("listeningTest")
        : t("readingTest");
  const modeLabel = type === "PRACTICE"
    ? `${t("practiceMode")} · ${attemptModeLabel}`
    : attemptModeLabel;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-5 lg:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{getTestName(testId)} · {modeLabel}</p>
          <p className="truncate text-xs font-medium text-slate-500">
            {section === "LISTENING" || section === "AWAITING_SUBMISSION" ? t("listening") : t("reading")} · {t("questions")} {firstQuestion}–{lastQuestion}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <div
            className={`rounded-lg px-3 py-1.5 text-center sm:px-4 ${
              isUrgent ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-sky-100 text-sky-800 ring-1 ring-sky-200"
            }`}
          >
            <p className="hidden text-[9px] font-semibold uppercase tracking-widest opacity-70 sm:block">
              {isUntimed ? t("untimed") : isElapsed ? t("elapsed") : t("remaining")}
            </p>
            <p className="font-mono text-sm font-bold tabular-nums sm:text-base">
              {isUntimed ? "∞" : formatClock(remainingSeconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:px-4 sm:text-sm"
          >
            {t("exit")}
          </button>
        </div>
      </div>
    </header>
  );
}

export default ExamHeader;
