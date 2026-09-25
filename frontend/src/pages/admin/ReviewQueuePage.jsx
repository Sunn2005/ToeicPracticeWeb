import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPendingSubmissions } from "../../api/adminReviews";

function ReviewQueuePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPendingSubmissions().then((data) => setItems(Array.isArray(data) ? data : [])).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Yêu cầu chờ duyệt</h1>
      <p className="mt-2 text-sm text-slate-500">Kiểm tra nội dung trước khi phát hành đề thi.</p>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="mt-7 space-y-3">
        {items.map((item) => (
          <article key={item.testId} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><h2 className="truncate font-bold text-slate-900">{item.title}</h2><p className="mt-1 text-sm text-slate-500">Người tạo: {item.createdBy || "Không xác định"} · Nộp ngày {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("vi-VN") : "—"}</p></div>
            <Link to={`/console/reviews/${item.testId}`} className="rounded-xl border border-blue-400 px-4 py-2.5 text-center text-sm font-bold text-blue-600 hover:bg-blue-50">Mở để duyệt</Link>
          </article>
        ))}
        {loading && <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Đang tải hàng chờ...</p>}
        {!loading && items.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Không có yêu cầu nào đang chờ duyệt.</p>}
      </div>
    </section>
  );
}

export default ReviewQueuePage;
