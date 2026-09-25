import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEmployeeTests } from "../../api/employeeTests";

const labels = {
  DRAFT: ["Bản nháp", "bg-slate-100 text-slate-700"],
  PENDING_REVIEW: ["Chờ duyệt", "bg-amber-100 text-amber-700"],
  APPROVED: ["Đã duyệt", "bg-emerald-100 text-emerald-700"],
  REJECTED: ["Bị từ chối", "bg-red-100 text-red-700"],
};

function MyTestsPage() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getEmployeeTests();
      setTests(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Không thể tải danh sách đề thi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Quản lý đề thi</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sách đề thi do tài khoản của bạn tạo.</p>
        </div>
        <Link to="/console/tests/new" className="inline-flex items-center justify-center rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-600">+ Tạo đề mới</Link>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr><th className="px-6 py-4">Tên đề</th><th className="px-4 py-4">Loại</th><th className="px-4 py-4">Cập nhật</th><th className="px-4 py-4">Trạng thái</th><th className="px-6 py-4 text-right">Mã đề</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((test) => {
                const status = labels[test.status] || [test.status || "Không rõ", "bg-slate-100 text-slate-600"];
                return (
                  <tr key={test.testId} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{test.title || "Đề chưa đặt tên"}</td>
                    <td className="px-4 py-4 text-slate-500">{test.type === "PRACTICE" ? "Mini Test" : "Full Test"}</td>
                    <td className="px-4 py-4 text-slate-500">{test.updatedAt ? new Date(test.updatedAt).toLocaleDateString("vi-VN") : "—"}</td>
                    <td className="px-4 py-4"><span className={`rounded-md px-2.5 py-1 text-xs font-bold ${status[1]}`}>{status[0]}</span></td>
                    <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">{test.testId}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && <p className="p-12 text-center text-sm text-slate-500">Đang tải danh sách đề...</p>}
        {!loading && tests.length === 0 && <div className="p-12 text-center"><p className="text-sm text-slate-500">Bạn chưa có đề thi nào.</p><Link to="/console/tests/new" className="mt-3 inline-block text-sm font-bold text-blue-600">Tạo đề đầu tiên</Link></div>}
      </div>
    </section>
  );
}

export default MyTestsPage;
