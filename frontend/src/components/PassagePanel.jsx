function PassagePanel({ passages = [] }) {
  if (!passages.length) {
    return null;
  }

  return (
    <section className="space-y-4">
      {passages.map((passage, index) => (
        <article
          key={`${passage.passageNumber || index}-${passage.title || "passage"}`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
              {passage.type || passage.passageType || `Đoạn văn ${index + 1}`}
            </p>
            {passage.title && (
              <p className="text-sm font-semibold text-slate-800">{passage.title}</p>
            )}
          </div>
          {passage.imageUrl && (
            <img
              src={passage.imageUrl}
              alt="Hình ảnh kèm đoạn đọc"
              className="mx-auto mt-5 max-h-[520px] max-w-full rounded-xl object-contain"
            />
          )}
          {passage.content && (
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">
              {passage.content}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export default PassagePanel;
