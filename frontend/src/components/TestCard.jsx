function TestCard({ test, onSelect }) {
  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-linear-to-br from-white to-sky-50/70 p-6 shadow-sm transition duration-200 sm:p-7 ${
        test.available
          ? "border-sky-100 hover:-translate-y-1 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100"
          : "border-slate-200 opacity-70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-lg font-black text-white shadow-lg shadow-sky-200">
          {test.name.replace("Test ", "T")}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
            test.available
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {test.available ? "Ready" : "Coming soon"}
        </span>
      </div>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-sky-600">
        {test.name}
      </p>
      <h4 className="mt-2 text-xl font-bold leading-7 text-slate-950">
        {test.title}
      </h4>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
          {test.totalQuestions} questions
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
          {test.duration} min
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
          Part 1–7
        </span>
      </div>

      <button
        type="button"
        onClick={() => onSelect(test)}
        disabled={!test.available}
        className="mt-6 inline-flex items-center gap-2 font-bold text-sky-600 transition group-hover:gap-3 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {test.available ? "Select test →" : "No data yet"}
      </button>
    </article>
  );
}

export default TestCard;
