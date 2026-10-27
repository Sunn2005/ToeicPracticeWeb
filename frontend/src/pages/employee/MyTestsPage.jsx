import { useAuth } from "../../auth/useAuth";
import { canUseConsole } from "../../auth/consolePermissions";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getEmployeeTests,
  deleteEmployeeTest,
  submitEmployeeTest,
} from "../../api/employeeTests";

const labels = {
  DRAFT: ["Bản nháp", "bg-slate-100 text-slate-700"],
  PENDING_REVIEW: ["Chờ duyệt", "bg-amber-100 text-amber-700"],
  APPROVED: ["Đã duyệt", "bg-emerald-100 text-emerald-700"],
  REJECTED: ["Bị từ chối", "bg-red-100 text-red-700"],
};

function MyTestsPage() {
  const { profile } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

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

  // Initial load: state already starts as loading with no error, so only
  // async completions update state here. Manual refreshes reuse load().
  useEffect(() => {
    let cancelled = false;
    getEmployeeTests()
      .then((data) => {
        if (!cancelled) setTests(Array.isArray(data) ? data : []);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Không thể tải danh sách đề thi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (testId, title) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đề thi "${title || testId}"?`)) {
      return;
    }
    setActionLoadingId(testId);
    try {
      await deleteEmployeeTest(testId);
      setTests((current) => current.filter((t) => t.testId !== testId));
    } catch (delError) {
      alert(delError.message || "Xóa đề thi thất bại.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmit = async (testId) => {
    if (!window.confirm("Gửi đề thi này để Quản trị viên duyệt?")) return;
    setActionLoadingId(testId);
    try {
      await submitEmployeeTest(testId);
      load();
    } catch (subError) {
      alert(subError.message || "Gửi duyệt thất bại.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Quản lý đề thi</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sách đề thi do tài khoản của bạn tạo.</p>
        </div>
        {canUseConsole(profile, "tests.add") && <Link
          to="/console/tests/new"
          className="inline-flex items-center justify-center rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-600 transition"
        >
          + Tạo đề mới (Wizard)
        </Link>}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-6 py-4">Tên đề thi</th>
                <th className="px-4 py-4">Loại</th>
                <th className="px-4 py-4">Cập nhật</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((test) => {
                const status = labels[test.status] || [test.status || "Không rõ", "bg-slate-100 text-slate-600"];
                const isEditable = test.status === "DRAFT" || test.status === "REJECTED";
                const isProcessing = actionLoadingId === test.testId;

                return (
                  <tr key={test.testId} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {test.title || "Đề chưa đặt tên"}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                        ID: {test.testId}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {test.type === "PRACTICE" ? "Mini Test" : "Full Test"}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {test.updatedAt ? new Date(test.updatedAt).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${status[1]}`}>
                        {status[0]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {isEditable && canUseConsole(profile, "tests.edit") && (
                          <Link
                            to={`/console/tests/${encodeURIComponent(test.testId)}/edit`}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                          >
                            Sửa
                          </Link>
                        )}
                        <Link
                          to={`/console/tests/${encodeURIComponent(test.testId)}/preview`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                        >
                          Xem trước
                        </Link>
                        {isEditable && (
                          <>
                            {canUseConsole(profile, "tests.edit") && <button
                              type="button"
                              onClick={() => handleSubmit(test.testId)}
                              disabled={isProcessing}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              Gửi duyệt
                            </button>}
                            {canUseConsole(profile, "tests.delete") && <button
                              type="button"
                              onClick={() => handleDelete(test.testId, test.title)}
                              disabled={isProcessing}
                              className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                              title="Xóa đề"
                            >
                              ✕
                            </button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && <p className="p-12 text-center text-sm text-slate-500">Đang tải danh sách đề...</p>}
        {!loading && tests.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">Bạn chưa có đề thi nào.</p>
            {canUseConsole(profile, "tests.add") && <Link to="/console/tests/new" className="mt-3 inline-block text-sm font-bold text-blue-600">
              Tạo đề đầu tiên
            </Link>}
          </div>
        )}
      </div>
    </section>
  );
}

export default MyTestsPage;
