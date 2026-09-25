import { useEffect, useState } from "react";
import { getReviewHistory } from "../../api/adminReviews";

function ReviewHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getReviewHistory().then((data) => setItems(Array.isArray(data) ? data : [])).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Lịch sử phê duyệt</h1>
      <p className="mt-2 text-sm text-slate-500">Các đề đã được duyệt hoặc trả lại để chỉnh sửa.</p>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold text-slate-500"><tr><th className="px-6 py-4">Tên đề</th><th className="px-4 py-4">Người tạo</th><th className="px-4 py-4">Ngày duyệt</th><th className="px-4 py-4">Kết quả</th><th className="px-6 py-4">Ghi chú</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((item) => <tr key={`${item.testId}-${item.reviewedAt}`}><td className="px-6 py-4 font-semibold text-slate-900">{item.title}</td><td className="px-4 py-4 text-slate-500">{item.createdBy || "—"}</td><td className="px-4 py-4 text-slate-500">{item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString("vi-VN") : "—"}</td><td className="px-4 py-4"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${item.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{item.status === "APPROVED" ? "Đã duyệt" : "Từ chối"}</span></td><td className="max-w-80 px-6 py-4 text-slate-500">{item.rejectionReason || "—"}</td></tr>)}</tbody></table></div>
        {loading && <p className="p-12 text-center text-sm text-slate-500">Đang tải lịch sử...</p>}
        {!loading && items.length === 0 && <p className="p-12 text-center text-sm text-slate-500">Chưa có lịch sử phê duyệt.</p>}
      </div>
    </section>
  );
}

export default ReviewHistoryPage;
