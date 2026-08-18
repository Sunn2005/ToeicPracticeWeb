function PassagePanel({ passages = [], imageUrls = [] }) {
  const groupImages = [...new Set(imageUrls.filter(Boolean))];

  if (!passages.length && !groupImages.length) {
    return null;
  }

  if (groupImages.length) {
    return (
      <section className="space-y-4" aria-label="Nội dung bài đọc">
        {groupImages.map((imageUrl, index) => (
          <article
            key={imageUrl}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
          >
            <img
              src={imageUrl}
              alt={`Nội dung bài đọc ${index + 1}`}
              className="mx-auto h-auto max-h-[72vh] w-auto max-w-full rounded-xl object-contain"
            />
          </article>
        ))}
      </section>
    );
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
          {!passage.imageUrl && passage.content && (
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
