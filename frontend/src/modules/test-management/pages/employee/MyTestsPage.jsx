import usePageTitle from "../../../../components/ui/usePageTitle";
import { useAuth } from "../../../../auth/useAuth";
import { canUseConsole } from "../../../../auth/consolePermissions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/test-editor/ConfirmDialog";
import {
  getEmployeeTests,
  deleteEmployeeTest,
  submitEmployeeTest,
} from "../../../../api/tests/employeeTests";

const labels = {
  DRAFT: ["Bản nháp", "bg-slate-100 text-slate-700"],
  PENDING_REVIEW: ["Chờ duyệt", "bg-amber-100 text-amber-700"],
  APPROVED: ["Đã duyệt", "bg-emerald-100 text-emerald-700"],
  REJECTED: ["Bị từ chối", "bg-red-100 text-red-700"],
};

function MyTestsPage() {
  usePageTitle("Quản lý đề thi");
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(location.state?.successMessage || "");
  const [pendingAction, setPendingAction] = useState(null);

  // Show a one-time success message handed over by the editor/preview after
  // submission, then scrub it from history so a refresh does not repeat it.
  useEffect(() => {
    if (notice) navigate(location.pathname, { replace: true, state: {} });
  }, [notice, location.pathname, navigate]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Client-side filtering is enough: the API already returns only the
  // employee's own tests as lightweight metadata. Title matching ignores
  // case and Vietnamese diacritics ("de nghe" matches "Đề nghe").
  const visibleTests = useMemo(() => {
    const normalizeText = (value) =>
      (value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const needle = normalizeText(query.trim());
    return tests.filter((test) => {
      if (statusFilter !== "ALL" && test.status !== statusFilter) return false;
      return !needle || normalizeText(test.title).includes(needle);
    });
  }, [tests, query, statusFilter]);

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

  const handleDelete = (test) => setPendingAction({ kind: "delete", test });

  const doPendingAction = async () => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    const testId = action.test.testId;
    setActionLoadingId(testId);
    try {
      if (action.kind === "delete") {
        await deleteEmployeeTest(testId);
        setTests((current) => current.filter((t) => t.testId !== testId));
      } else {
        await submitEmployeeTest(testId);
        load();
      }
    } catch (actionError) {
      setError(actionError.message || (action.kind === "delete" ? "Xóa đề thi thất bại." : "Gửi duyệt thất bại."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSubmit = (test) => setPendingAction({ kind: "submit", test });

  return (
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500">Danh sách đề thi do tài khoản của bạn tạo.</p>
        </div>
        {canUseConsole(profile, "tests.add") && <Link
          to="/console/tests/new"
          className="inline-flex items-center justify-center rounded-xl bg-[#2188ee] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-600 transition"
        >
          + Tạo đề mới
        </Link>}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="font-bold text-emerald-600" aria-label="Đóng thông báo">✕</button>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên đề (không cần dấu)..."
          aria-label="Tìm theo tên đề"
          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Lọc theo trạng thái"
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="DRAFT">Bản nháp</option>
          <option value="PENDING_REVIEW">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Bị từ chối</option>
        </select>
        {(query.trim() || statusFilter !== "ALL") && (
          <span className="text-xs font-semibold text-slate-500">
            Hiển thị {visibleTests.length}/{tests.length} đề
          </span>
        )}
      </div>

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
              {visibleTests.map((test) => {
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
                              onClick={() => handleSubmit(test)}
                              disabled={isProcessing}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
                            >
                              Gửi duyệt
                            </button>}
                            {canUseConsole(profile, "tests.delete") && <button
                              type="button"
                              onClick={() => handleDelete(test)}
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
        {!loading && tests.length > 0 && visibleTests.length === 0 && (
          <p className="p-12 text-center text-sm text-slate-500">Không tìm thấy đề nào khớp với tìm kiếm hoặc bộ lọc trạng thái.</p>
        )}
        {!loading && tests.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">Bạn chưa có đề thi nào.</p>
            {canUseConsole(profile, "tests.add") && <Link to="/console/tests/new" className="mt-3 inline-block text-sm font-bold text-blue-600">
              Tạo đề đầu tiên
            </Link>}
          </div>
        )}
      </div>

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.kind === "delete" ? "Xóa đề thi" : "Gửi phê duyệt"}
          message={pendingAction.kind === "delete"
            ? `Bạn có chắc chắn muốn xóa đề thi "${pendingAction.test.title || pendingAction.test.testId}"? Hành động này không thể hoàn tác.`
            : "Gửi đề thi này để Quản trị viên duyệt? Sau khi gửi, bạn sẽ không sửa được cho đến khi có kết quả duyệt."}
          confirmLabel={pendingAction.kind === "delete" ? "Xóa đề" : "Gửi duyệt"}
          danger={pendingAction.kind === "delete"}
          busy={actionLoadingId === pendingAction.test.testId}
          onConfirm={doPendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}
    </section>
  );
}

export default MyTestsPage;
