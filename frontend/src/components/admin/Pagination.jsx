// Thanh phân trang dùng chung cho các bảng admin, đúng Figma:
// "Trước 1 2 3 Sau" — trang hiện tại tô đậm màu xanh, các nút còn lại viền xám.
function buildPageList(page, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const wanted = [1, pageCount, page - 1, page, page + 1].filter(
    (number) => number >= 1 && number <= pageCount,
  );
  const unique = [...new Set(wanted)].sort((a, b) => a - b);
  const withGaps = [];
  unique.forEach((number, index) => {
    if (index > 0 && number - unique[index - 1] > 1) withGaps.push("...");
    withGaps.push(number);
  });
  return withGaps;
}

function Pagination({ page, pageCount, onPageChange }) {
  if (pageCount <= 1) return null;

  const pageList = buildPageList(page, pageCount);
  const numberClassName = (active) =>
    `min-w-9 rounded-lg px-2.5 py-2 text-sm font-semibold transition ${
      active
        ? "bg-[#2188ee] text-white"
        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
    }`;
  const arrowClassName =
    "rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40";

  return (
    <nav aria-label="Phân trang" className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={arrowClassName}
      >
        Trước
      </button>
      {pageList.map((item, index) =>
        item === "..." ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-slate-400">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={numberClassName(item === page)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className={arrowClassName}
      >
        Sau
      </button>
    </nav>
  );
}

export default Pagination;
