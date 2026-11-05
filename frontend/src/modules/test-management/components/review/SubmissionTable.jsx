import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 8;

const STATUS_LABELS = {
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

const TYPE_LABELS = {
  FULL_TEST: "Full Test",
  PRACTICE: "Mini Test",
};

function formatWaitingTime(timestamp) {
  if (!timestamp) return "—";
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Vừa nộp";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

function formatFullDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("vi-VN");
}

// Chuyển timestamp sang "yyyy-mm-dd" theo giờ địa phương để so với <input type="date">.
// Vì sao không dùng toISOString().slice(0, 10): toISOString trả về giờ UTC,
// ở múi giờ +07 đề nộp lúc 1h sáng sẽ bị lùi về ngày hôm trước.
function toLocalDateInputValue(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Bảng hàng đợi duyệt đúng Figma frame 2 (Pending Reviews):
// tìm kiếm + lọc (người tạo/trạng thái/ngày gửi) + sắp xếp "Cũ nhất trước"
// + phân trang 8 dòng/trang + 2 trạng thái empty (frame 3) và no-result (frame 4).
//
// Vì sao lọc/sắp xếp/phân trang làm ở client thay vì gọi API:
// - API GET /api/admin/test-submissions không có query param lọc/phân trang,
//   trả toàn bộ queue về một lần (đã sắp xếp submittedAt cũ nhất trước).
// - Hàng đợi duyệt của admin thường chỉ vài chục đề, lọc client-side nhanh,
//   đơn giản và đúng quy ước nhóm. Nếu sau này queue lên hàng nghìn đề,
//   backend thêm query param thì mới chuyển sang lọc server-side.
//
// Cách dùng: <SubmissionTable items={items} loading={loading} />
// - items: mảng TestMetadata từ getPendingSubmissions().
// - loading: true khi đang tải — bảng hiện skeleton, không hiện nhầm empty.
function SubmissionTable({ items, loading = false }) {
  const [search, setSearch] = useState("");
  const [creator, setCreator] = useState("");
  const [status, setStatus] = useState("");
  const [submitDate, setSubmitDate] = useState("");
  const [sortOrder, setSortOrder] = useState("oldest");
  const [page, setPage] = useState(1);

  const hasActiveFilter = search.trim() !== "" || creator !== "" || status !== "" || submitDate !== "";

  // Đổi bộ lọc/tìm kiếm/sắp xếp thì quay về trang 1, tránh kẹt ở trang
  // trống khi kết quả mới ít hơn trang đang đứng.
  // (Không dùng useEffect để setPage vì lint cấm setState đồng bộ trong effect.)
  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const creators = useMemo(() => {
    const unique = new Set();
    items.forEach((item) => {
      if (item.createdBy) unique.add(item.createdBy);
    });
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const availableStatuses = useMemo(
    () => Object.keys(STATUS_LABELS).filter((key) => items.some((item) => item.status === key)),
    [items],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const result = items.filter((item) => {
      if (keyword) {
        const haystack = `${item.title || ""} ${item.createdBy || ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (creator && item.createdBy !== creator) return false;
      if (status && item.status !== status) return false;
      if (submitDate && toLocalDateInputValue(item.submittedAt) !== submitDate) return false;
      return true;
    });
    // API đã trả queue xếp cũ nhất trước, nhưng sắp xếp lại ở đây để chắc
    // chắn đúng thứ tự sau khi user đổi qua "Mới nhất trước".
    const bySubmittedAt = (a, b) => (a.submittedAt || 0) - (b.submittedAt || 0);
    return sortOrder === "oldest"
      ? [...result].sort(bySubmittedAt)
      : [...result].sort((a, b) => bySubmittedAt(b, a));
  }, [items, search, creator, status, submitDate, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const clearFilters = () => {
    setSearch("");
    setCreator("");
    setStatus("");
    setSubmitDate("");
    setSortOrder("oldest");
    setPage(1);
  };

  const selectClassName =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

  return (
    <div>
      {/* Thanh tìm kiếm + bộ lọc */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <input
            type="search"
            value={search}
            onChange={updateFilter(setSearch)}
            placeholder="Tìm kiếm theo tên đề thi, người tạo..."
            aria-label="Tìm kiếm đề thi"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <select value={creator} onChange={updateFilter(setCreator)} aria-label="Lọc theo người tạo" className={selectClassName}>
            <option value="">Tất cả người tạo</option>
            {creators.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select value={status} onChange={updateFilter(setStatus)} aria-label="Lọc theo trạng thái" className={selectClassName}>
            <option value="">Tất cả trạng thái</option>
            {availableStatuses.map((key) => (
              <option key={key} value={key}>{STATUS_LABELS[key]}</option>
            ))}
          </select>
          <input
            type="date"
            value={submitDate}
            onChange={updateFilter(setSubmitDate)}
            aria-label="Lọc theo ngày gửi"
            className={selectClassName}
          />
          <select value={sortOrder} onChange={updateFilter(setSortOrder)} aria-label="Sắp xếp" className={selectClassName}>
            <option value="oldest">Cũ nhất trước</option>
            <option value="newest">Mới nhất trước</option>
          </select>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-5 py-4">Tên đề thi</th>
                <th className="px-4 py-4">Loại đề thi</th>
                <th className="px-4 py-4">Người tạo đề</th>
                <th className="px-4 py-4">Thời gian chờ duyệt</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-5 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((item) => (
                <tr key={item.testId} className="transition hover:bg-slate-50/70">
                  <td className="max-w-64 truncate px-5 py-4 font-semibold text-slate-900" title={item.title}>
                    {item.title || "Đề chưa đặt tên"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                    {TYPE_LABELS[item.type] || item.type || "—"}
                  </td>
                  <td className="max-w-40 truncate px-4 py-4 text-slate-500" title={item.createdBy}>
                    {item.createdBy || "Không xác định"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500" title={formatFullDate(item.submittedAt)}>
                    {formatWaitingTime(item.submittedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                      {STATUS_LABELS[item.status] || item.status || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/console/reviews/${item.testId}`}
                      className="inline-flex rounded-lg border border-blue-400 px-3.5 py-2 text-xs font-bold text-[#2188ee] transition hover:bg-blue-50"
                    >
                      Xem xét
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <p className="p-12 text-center text-sm text-slate-500">Đang tải hàng chờ...</p>
        )}

        {/* Frame 3 Figma: hàng đợi trống hoàn toàn (không có bộ lọc nào bật) */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center p-12 text-center">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-emerald-600">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <p className="mt-4 font-bold text-slate-900">Không có yêu cầu chờ duyệt</p>
            <p className="mt-1 text-sm text-slate-500">Tất cả đề thi đã được xử lý xong.</p>
          </div>
        )}

        {/* Frame 4 Figma: có dữ liệu nhưng bộ lọc không khớp kết quả nào */}
        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center p-12 text-center">
            <p className="font-bold text-slate-900">Không tìm thấy kết quả phù hợp</p>
            <p className="mt-1 text-sm text-slate-500">Thử điều chỉnh từ khóa hoặc bộ lọc của bạn.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl border border-blue-400 px-5 py-2.5 text-sm font-bold text-[#2188ee] hover:bg-blue-50"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}

        {/* Phân trang */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              Đang hiển thị {rangeStart}–{rangeEnd} của {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="text-sm font-semibold text-slate-700" aria-live="polite">
                Trang {safePage}/{pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={safePage >= pageCount}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {hasActiveFilter && !loading && filtered.length > 0 && (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-3 text-sm font-semibold text-[#2188ee] hover:text-blue-700"
        >
          Xóa tất cả bộ lọc
        </button>
      )}
    </div>
  );
}

export default SubmissionTable;
