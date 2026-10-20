import { useLanguage } from "../i18n/LanguageContext";

const TONES = {
  sky: "bg-sky-100 text-sky-700",
  cyan: "bg-cyan-100 text-cyan-700",
  violet: "bg-violet-100 text-violet-700",
};

function ModeIcon({ mode }) {
  if (mode.id === "LISTENING") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <path d="M4 14a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3ZM20 14a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z" />
      </svg>
    );
  }
  if (mode.id === "READING") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5h6M9 3h6v4H9z" />
      <path d="M7 5H5v16h14V5h-2M8 12l2 2 5-5M8 18h8" />
    </svg>
  );
}

function ExamModeCard({ mode, experience = "exam", starting, disabled, onStart }) {
  const { t } = useLanguage();
  const translatedName = mode.id === "FULL"
    ? t("fullTest")
    : mode.id === "LISTENING"
      ? t("listeningTest")
      : t("readingTest");
  const translatedDescription = mode.id === "FULL"
    ? t("completeTestDescription")
    : mode.id === "LISTENING"
      ? t("listeningOnlyDescription")
      : t("readingOnlyDescription");
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black ${TONES[mode.tone]}`}>
          <ModeIcon mode={mode} />
        </span>
        <span><h3 className="font-bold text-slate-950">{translatedName}</h3><p className="mt-0.5 text-xs text-slate-500">{translatedDescription}</p></span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1.5">
          {experience === "practice" ? t("untimed") : `${mode.duration} ${t("minuteShort")}`}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{mode.questions} {t("questions")}</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-sky-700">{mode.parts}</p>
      <button
        type="button"
        onClick={() => onStart({ mode: mode.id, part: null, experience })}
        disabled={disabled}
        className={`mt-4 w-full rounded-lg border px-4 py-2.5 text-sm font-bold transition disabled:cursor-wait disabled:opacity-50 ${experience === "practice" ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border-sky-500 bg-sky-500 text-white hover:bg-sky-600"}`}
      >
        {starting ? t("preparing") : t("start")}
      </button>
    </article>
  );
}

export default ExamModeCard;
