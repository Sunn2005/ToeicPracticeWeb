import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getReviewHistory } from "../../api/adminReviews";

const PAGE_SIZE = 8;

const RESULT_CONFIG = {
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-700" },
};

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("vi-VN");
}

// Trang Lịch sử phê duyệt đúng Figma frame 5:
// bảng (Tên đề, Người tạo, Ngày duyệt, Kết quả, Ghi chú) + tìm kiếm +
// lọc kết quả + phân trang 8 dòng/trang với dòng "Đang hiển thị X–Y của Z".
// Bấm vào một dòng để xem chi tiết (Figma frame 6).
//
// Vì sao bấm vào dòng lại dẫn sang /console/reviews/:testId thay vì route mới:
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
  const [result, setResult] = useState("");
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

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    // API đã trả lịch sử xếp lần review mới nhất trước (mục 9.5 docs).
    return items.filter((item) => {
      if (keyword) {
        const haystack = `${item.title || ""} ${item.createdBy || ""}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      if (result && item.status !== result) return false;
      return true;
    });
  }, [items, search, result]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const selectClassName =
    "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Lịch sử phê duyệt</h1>
      <p className="mt-2 text-sm text-slate-500">Các đề đã được duyệt hoặc trả lại để chỉnh sửa.</p>

      {error && (
        <div role="alert" className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadHistory} className="font-bold underline underline-offset-4">
            Thử lại
          </button>
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={updateFilter(setSearch)}
          placeholder="Tìm kiếm theo tên đề thi, người tạo..."
          aria-label="Tìm kiếm lịch sử phê duyệt"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 sm:max-w-xs"
        />
        <select value={result} onChange={updateFilter(setResult)} aria-label="Lọc theo kết quả" className={selectClassName}>
          <option value="">Tất cả kết quả</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Từ chối</option>
        </select>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-6 py-4">Tên đề</th>
                <th className="px-4 py-4">Người tạo</th>
                <th className="px-4 py-4">Ngày duyệt</th>
                <th className="px-4 py-4">Kết quả</th>
                <th className="px-6 py-4">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((item) => {
                const config = RESULT_CONFIG[item.status] || { label: item.status || "—", className: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={`${item.testId}-${item.reviewedAt}`} className="transition hover:bg-slate-50/70">
                    <td className="max-w-64 px-6 py-4">
                      <Link
                        to={`/console/reviews/${item.testId}`}
                        className="font-semibold text-[#2188ee] hover:text-blue-700 hover:underline"
                        title={item.title}
                      >
                        <span className="block truncate">{item.title || "Đề chưa đặt tên"}</span>
                      </Link>
                    </td>
                    <td className="max-w-40 truncate px-4 py-4 text-slate-500" title={item.createdBy}>
                      {item.createdBy || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      {formatDate(item.reviewedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${config.className}`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="max-w-80 truncate px-6 py-4 text-slate-500" title={item.rejectionReason || ""}>
                      {item.rejectionReason || "—"}
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
              onClick={() => { setSearch(""); setResult(""); setPage(1); }}
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
    </section>
  );
}

export default ReviewHistoryPage;
