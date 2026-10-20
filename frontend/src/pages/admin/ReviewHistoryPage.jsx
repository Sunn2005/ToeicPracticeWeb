import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getReviewHistory } from "../../api/adminReviews";
import Pagination from "../../components/admin/Pagination";

const PAGE_SIZE = 8; // Đúng Figma frame Review History: "Đang hiển thị 1-8 của 45".

const RESULT_CONFIG = {
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-700" },
};

const TYPE_LABELS = {
  FULL_TEST: "Full Test",
  PRACTICE: "Mini Test",
};

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("vi-VN");
}

// Trang Lịch sử phê duyệt đúng Figma frame 5:
// bảng 7 cột (Tên đề thi, Loại, Người tạo, Người duyệt, Ngày duyệt, Kết quả,
// Thao tác) + tìm kiếm + lọc (người tạo/kết quả/ngày duyệt) + sắp xếp +
// phân trang 8 dòng/trang với dòng "Đang hiển thị X–Y của Z".
//
// Vì sao bấm "Chi tiết" lại dẫn sang /console/reviews/:testId thay vì route mới:
// - File App.jsx (định nghĩa route) bị khóa, không thuộc scope Member 4.
// - Route /console/reviews/:testId đã tồn tại và TestReviewPage tự chuyển
//   sang chế độ chỉ đọc (badge Đã duyệt/Từ chối + thẻ Thông tin phê duyệt +
//   preview đề + timeline) khi đề không còn PENDING_REVIEW — đúng nội dung
//   frame 6 mà không cần thêm route.
function ReviewHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [creator, setCreator] = useState("");
  const [result, setResult] = useState("");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getReviewHistory();
      setItems(Array.isArray(data) ? data : []);
    } catch (loadError) {
      // Xử lý theo HTTP status + code, đúng quy ước nhóm.
      if (loadError?.status === 401) {
        setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (loadError?.status === 403) {
        setError("Tài khoản của bạn không có quyền truy cập trang này.");
      } else {
        setError(loadError?.message || "Không thể tải lịch sử phê duyệt. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Tải lịch sử khi mở trang; state chỉ đổi sau khi request xong.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  const creators = useMemo(
    () => [...new Set(items.map((item) => item.createdBy).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    // API trả lịch sử xếp lần review mới nhất trước (mục 9.5 docs);
    // sắp xếp lại theo lựa chọn của người dùng.
    const sorted = [...items].sort((a, b) => {
      const timeA = new Date(a.reviewedAt || 0).getTime();
      const timeB = new Date(b.reviewedAt || 0).getTime();
      return sort === "newest" ? timeB - timeA : timeA - timeB;
    });
    return sorted.filter((item) => {
      if (keyword) {
        const haystack = `${item.title || ""} ${item.createdBy || ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (creator && item.createdBy !== creator) return false;
      if (result && item.status !== result) return false;
      if (date) {
        const reviewed = item.reviewedAt ? new Date(item.reviewedAt) : null;
        if (!reviewed || reviewed.toISOString().slice(0, 10) !== date) return false;
      }
      return true;
    });
  }, [items, search, creator, result, date, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const hasActiveFilters = search.trim() || creator || result || date;
  const clearFilters = () => {
    setSearch("");
    setCreator("");
    setResult("");
    setDate("");
    setPage(1);
  };

  const controlClassName =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

  return (
    <section className="mx-auto max-w-[1500px]">
      <nav aria-label="Đường dẫn" className="text-[13px] text-slate-400">
        TOEIC Master <span className="mx-1">/</span> History <span className="mx-1">/</span>{" "}
        <span className="font-semibold text-slate-600">Lịch sử phê duyệt</span>
      </nav>
      <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Lịch sử phê duyệt</h1>
      <p className="mt-2 text-sm text-slate-500">Xem lại các đề thi đã xử lý (Phê duyệt hoặc Từ chối).</p>

      {error && (
        <div role="alert" className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadHistory} className="font-bold underline underline-offset-4">
            Thử lại
          </button>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={updateFilter(setSearch)}
          placeholder="Tìm kiếm đề thi, người tạo..."
          aria-label="Tìm kiếm lịch sử phê duyệt"
          className={`${controlClassName} w-full sm:w-56`}
        />
        <select value={creator} onChange={updateFilter(setCreator)} aria-label="Lọc theo người tạo" className={controlClassName}>
          <option value="">Người tạo</option>
          {creators.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select value={result} onChange={updateFilter(setResult)} aria-label="Lọc theo kết quả" className={controlClassName}>
          <option value="">Tất cả kết quả</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
        <input
          type="date"
          value={date}
          onChange={updateFilter(setDate)}
          aria-label="Lọc theo ngày duyệt"
          className={controlClassName}
        />
        <select value={sort} onChange={updateFilter(setSort)} aria-label="Sắp xếp" className={controlClassName}>
          <option value="newest">Mới nhất trước</option>
          <option value="oldest">Cũ nhất trước</option>
        </select>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-bold text-[#2188ee] hover:underline">
            Xóa bộ lọc
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-4">Tên đề thi</th>
                <th className="px-4 py-4">Loại</th>
                <th className="px-4 py-4">Người tạo</th>
                <th className="px-4 py-4">Người duyệt</th>
                <th className="px-4 py-4">Ngày duyệt</th>
                <th className="px-4 py-4">Kết quả</th>
                <th className="px-6 py-4">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((item) => {
                const config = RESULT_CONFIG[item.status] || { label: item.status || "—", className: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={`${item.testId}-${item.reviewedAt}`} className="transition hover:bg-slate-50/70">
                    <td className="max-w-64 truncate px-6 py-4 font-semibold text-slate-900" title={item.title}>
                      {item.title || "Đề chưa đặt tên"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      {TYPE_LABELS[item.type] || item.type || "—"}
                    </td>
                    <td className="max-w-40 truncate px-4 py-4 text-slate-500" title={item.createdBy}>
                      {item.createdBy || "—"}
                    </td>
                    <td className="max-w-40 truncate px-4 py-4 text-slate-500" title={item.reviewedBy}>
                      {item.reviewedBy || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      {formatDate(item.reviewedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${config.className}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/console/reviews/${item.testId}`}
                        className="font-semibold text-[#2188ee] hover:text-blue-700 hover:underline"
                      >
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && <p className="p-12 text-center text-sm text-slate-500">Đang tải lịch sử...</p>}

        {!loading && items.length === 0 && (
          <p className="p-12 text-center text-sm text-slate-500">Chưa có lịch sử phê duyệt.</p>
        )}

        {!loading && items.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center p-12 text-center">
            <p className="font-bold text-slate-900">Không tìm thấy kết quả phù hợp</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 rounded-xl border border-blue-400 px-5 py-2.5 text-sm font-bold text-[#2188ee] hover:bg-blue-50"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              Đang hiển thị {rangeStart}–{rangeEnd} của {filtered.length}
            </p>
            <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
          </div>
        )}
      </div>
    </section>
  );
}

export default ReviewHistoryPage;
