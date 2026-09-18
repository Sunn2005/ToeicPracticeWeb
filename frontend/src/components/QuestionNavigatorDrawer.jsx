import { useEffect } from "react";
import { useLanguage } from "../i18n/LanguageContext";

function LegendItem({ className, label }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
      <span className={`h-7 w-7 rounded-lg border-2 ${className}`} />
      {label}
    </div>
  );
}

function QuestionNavigatorDrawer({
  open,
  onClose,
  groups,
  currentQuestion,
  answers,
  onSelect,
  navigationLocked = false,
  questionStatuses,
  reviewMode = false,
  title = "Question Navigator",
}) {
  const { t } = useLanguage();
  const drawerTitle = title === "Question Navigator" ? t("questionNavigator") : title;
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45"
        onClick={onClose}
        aria-label={t("closeQuestionNavigator")}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-navigator-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl sm:w-[min(86vw,680px)] xl:w-[30vw] xl:min-w-[520px] xl:max-w-[760px]"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 id="question-navigator-title" className="text-xl font-bold text-slate-950">
            {drawerTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl font-light text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label={t("closeQuestionNavigator")}
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {reviewMode ? (
            <div className="flex flex-wrap gap-x-5 gap-y-3 border-b border-slate-200 pb-5">
              <LegendItem className="border-sky-500 bg-sky-500" label={t("current")} />
              <LegendItem className="border-emerald-400 bg-emerald-50" label={t("correct")} />
              <LegendItem className="border-red-400 bg-red-50" label={t("incorrect")} />
              <LegendItem className="border-slate-300 bg-slate-100" label={t("unanswered")} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-3 border-b border-slate-200 pb-5">
              <LegendItem className="border-sky-500 bg-sky-500" label={t("current")} />
              <LegendItem className="border-slate-300 bg-white" label={t("unanswered")} />
              <LegendItem className="border-emerald-400 bg-emerald-50" label={t("answered")} />
            </div>
          )}

          {navigationLocked && (
            <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
              {t("listeningNavigatorNote")}
            </p>
          )}

          <div className="mt-5 space-y-7">
            {groups.map((group) => (
              <section key={group.partNumber}>
                <h3 className="text-lg font-bold text-slate-800">
                  {t("part")} {group.partNumber}
                  {group.partName && <span className="text-slate-500"> · {group.partName}</span>}
                  <span className="text-slate-500"> ({group.questions.length} {t("questions")})</span>
                </h3>
                <div className="mt-4 grid grid-cols-5 gap-2.5 sm:grid-cols-6">
                  {group.questions.map((number) => {
                    const isCurrent = number === currentQuestion;
                    const isAnswered = Boolean(answers[String(number)]);
                    const reviewStatus = questionStatuses?.[String(number)];
                    const statusClass = reviewMode
                      ? reviewStatus === "CORRECT"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : reviewStatus === "INCORRECT"
                          ? "border-red-400 bg-red-50 text-red-700"
                          : "border-slate-300 bg-slate-100 text-slate-600"
                      : isAnswered
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-white text-slate-600";
                    return (
                      <button
                        key={number}
                        type="button"
                        disabled={navigationLocked || !onSelect}
                        onClick={() => {
                          onSelect?.(number);
                          onClose();
                        }}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={`${t("goToQuestion")} ${number}`}
                        className={`aspect-square rounded-xl border-2 text-sm font-bold transition sm:text-base ${
                          isCurrent
                            ? "border-sky-500 bg-sky-500 text-white ring-2 ring-sky-200"
                            : statusClass
                        } ${navigationLocked ? "cursor-default" : "hover:border-sky-400 hover:bg-sky-50"}`}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default QuestionNavigatorDrawer;
