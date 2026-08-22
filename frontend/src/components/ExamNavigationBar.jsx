function NavigationButton({ children, disabled, onClick, title, variant = "secondary" }) {
  const variants = {
    secondary: "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
    primary: "border-sky-600 bg-sky-600 text-white hover:border-sky-700 hover:bg-sky-700",
    submit: "border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-h-11 min-w-0 rounded-lg border px-2 py-2.5 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:min-w-28 sm:px-5 sm:text-sm ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function ExamNavigationBar({
  progressLabel,
  onOpenNavigator,
  onPrevious,
  onNext,
  onSubmit,
  previousDisabled = false,
  nextDisabled = false,
  submitDisabled = false,
  previousTitle,
  nextTitle,
  statusMessage,
}) {
  return (
    <footer className="fixed inset-x-3 bottom-3 z-30 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-lg shadow-slate-900/10 backdrop-blur sm:inset-x-4 xl:sticky xl:inset-x-auto xl:bottom-3 xl:mt-3 xl:shrink-0 xl:shadow-sm">
      <div className="grid grid-cols-4 items-stretch gap-2 sm:flex sm:items-center">
        <NavigationButton
          onClick={onPrevious}
          disabled={previousDisabled}
          title={previousTitle}
        >
          <span aria-hidden="true">← </span>Previous
        </NavigationButton>

        <button
          type="button"
          onClick={onOpenNavigator}
          className="min-h-11 min-w-0 rounded-lg border border-sky-200 bg-sky-50 px-1.5 py-2.5 text-[11px] font-bold tabular-nums text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:min-w-24 sm:px-4 sm:text-sm"
          aria-label={`Open question navigator. Current progress ${progressLabel}`}
        >
          {progressLabel}
        </button>

        <NavigationButton
          variant="primary"
          onClick={onNext}
          disabled={nextDisabled}
          title={nextTitle}
        >
          Next<span aria-hidden="true"> →</span>
        </NavigationButton>

        <div className="sm:ml-auto">
          <NavigationButton
            variant="submit"
            onClick={onSubmit}
            disabled={submitDisabled}
          >
            Submit
          </NavigationButton>
        </div>
      </div>

      {statusMessage && (
        <p className="mt-2 px-1 text-center text-xs leading-5 text-slate-500 sm:text-right">
          {statusMessage}
        </p>
      )}
    </footer>
  );
}

export default ExamNavigationBar;
