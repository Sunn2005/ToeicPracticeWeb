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

function ExamModeCard({ mode, starting, disabled, onStart }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg">
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black ${TONES[mode.tone]}`}>
        <ModeIcon mode={mode} />
      </span>
      <h3 className="mt-5 text-lg font-bold text-slate-950">{mode.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{mode.description}</p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{mode.duration} phút</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5">{mode.questions} câu</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-sky-700">{mode.parts}</p>
      <button
        type="button"
        onClick={() => onStart({ mode: mode.id, part: null })}
        disabled={disabled}
        className="mt-6 w-full rounded-xl bg-sky-500 px-4 py-3 font-bold text-white shadow-md shadow-sky-100 transition hover:bg-sky-600 disabled:cursor-wait disabled:bg-sky-300"
      >
        {starting ? "Đang chuẩn bị..." : "Bắt đầu"}
      </button>
    </article>
  );
}

export default ExamModeCard;
