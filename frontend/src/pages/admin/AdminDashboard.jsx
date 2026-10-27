import { canUseConsole } from "../../auth/consolePermissions";
import { useLanguage } from "../../i18n/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPendingSubmissions, getReviewHistory } from "../../api/adminReviews";
import { getEmployeeTests } from "../../api/employeeTests";
import { useAuth } from "../../auth/useAuth";

const statusConfig = {
  DRAFT: { label: "Bản nháp", className: "bg-slate-100 text-slate-700" },
  PENDING_REVIEW: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Từ chối", className: "bg-red-100 text-red-700" },
};

function formatDate(timestamp) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(timestamp));
}

function formatRelative(timestamp) {
  if (!timestamp) return "Gần đây";
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Hôm qua" : `${days} ngày trước`;
}

function creatorName(test, ownProfile) {
  if (ownProfile && test.createdBy === ownProfile.uid) {
    return ownProfile.displayName || ownProfile.email || "Bạn";
  }
  return test.createdByDisplayName || test.creatorName || (test.createdBy ? `NV ${test.createdBy.slice(0, 7)}` : "Không xác định");
}

function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status || "Không rõ", className: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${config.className}`}>{config.label}</span>;
}

function StatIcon({ type }) {
  const paths = {
    pending: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    approved: "m8 12 3 3 5-6m5 3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    rejected: "M12 9v4m0 4h.01M10.3 4.8 2.2 19a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-[#2188ee]"><path d={paths[type]} /></svg>;
}

function AdminDashboardContent() {
  const { role, profile } = useAuth();
  const isAdmin = role === "ADMIN";
  const [pending, setPending] = useState([]);
  const [history, setHistory] = useState([]);
  const [ownTests, setOwnTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const [pendingItems, historyItems] = await Promise.all([
          getPendingSubmissions(),
          getReviewHistory(),
        ]);
        setPending(Array.isArray(pendingItems) ? pendingItems : []);
        setHistory(Array.isArray(historyItems) ? historyItems : []);
        setOwnTests([]);
      } else {
        const tests = await getEmployeeTests();
        setOwnTests(Array.isArray(tests) ? tests : []);
        setPending([]);
        setHistory([]);
      }
    } catch (loadError) {
      setError(loadError.message || "Không thể tải dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    document.title = "Dashboard Console | CapyTOEIC";
    // The loader is async; state updates after the request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  const allTests = useMemo(
    () => (isAdmin ? [...pending, ...history] : ownTests),
    [isAdmin, pending, history, ownTests],
  );
  const stats = [
    { title: "Yêu cầu chờ duyệt", value: isAdmin ? pending.length : ownTests.filter((test) => test.status === "PENDING_REVIEW").length, status: "PENDING_REVIEW", icon: "pending" },
    { title: "Yêu cầu đã duyệt", value: (isAdmin ? history : ownTests).filter((test) => test.status === "APPROVED").length, status: "APPROVED", icon: "approved" },
    { title: "Yêu cầu bị từ chối", value: (isAdmin ? history : ownTests).filter((test) => test.status === "REJECTED").length, status: "REJECTED", icon: "rejected" },
  ];

  const tableItems = isAdmin
    ? pending.slice(0, 6)
    : [...ownTests].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 6);

  const creatorStats = useMemo(() => {
    const counts = new Map();
    allTests.forEach((test) => {
      const key = test.createdBy || "unknown";
      const existing = counts.get(key) || { name: creatorName(test, profile), count: 0 };
      existing.count += 1;
      counts.set(key, existing);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [allTests, profile]);

  const activities = useMemo(() => [...allTests]
    .sort((a, b) => (b.reviewedAt || b.submittedAt || b.updatedAt || 0) - (a.reviewedAt || a.submittedAt || a.updatedAt || 0))
    .slice(0, 5), [allTests]);

  return (
    <section className="mx-auto max-w-[1500px]">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Tổng quan hệ thống</h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            {isAdmin ? "Báo cáo số liệu và hoạt động của hệ thống phê duyệt." : "Theo dõi đề thi và trạng thái phê duyệt của bạn."}
          </p>
        </div>
        <button type="button" onClick={loadDashboard} disabled={loading} className="self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-50">
          {loading ? "Đang tải..." : "Làm mới dữ liệu"}
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadDashboard} className="font-bold underline underline-offset-4">Thử lại</button>
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {stats.map((stat) => (
          <article key={stat.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <div className="mt-5 flex items-center gap-4">
                  <strong className="text-4xl font-bold tracking-tight text-slate-950">{loading ? "—" : stat.value}</strong>
                  <StatusBadge status={stat.status} />
                </div>
              </div>
              <StatIcon type={stat.icon} />
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,2.2fr)_minmax(300px,1fr)]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">{isAdmin ? "Yêu cầu chờ duyệt" : "Đề thi gần đây"}</h2>
            <Link to={isAdmin ? "/console/reviews" : "/console/tests"} className="text-sm font-semibold text-[#2188ee] hover:text-blue-700">Xem tất cả</Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Tên đề thi</th>
                    <th className="px-4 py-4">Loại</th>
                    <th className="px-4 py-4">Người tạo</th>
                    <th className="px-4 py-4">Ngày cập nhật</th>
                    <th className="px-4 py-4">Trạng thái</th>
                    <th className="px-5 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {!loading && tableItems.map((test) => (
                    <tr key={test.testId} className="transition hover:bg-slate-50/70">
                      <td className="max-w-64 truncate px-5 py-4 font-semibold text-slate-900" title={test.title}>{test.title || "Đề chưa đặt tên"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-500">{test.type === "PRACTICE" ? "Mini Test" : "Full Test"}</td>
                      <td className="max-w-40 truncate px-4 py-4 text-slate-500">{creatorName(test, profile)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-500">{formatDate(test.submittedAt || test.updatedAt)}</td>
                      <td className="px-4 py-4"><StatusBadge status={test.status} /></td>
                      <td className="px-5 py-4 text-right">
                        <Link to={isAdmin ? `/console/reviews/${test.testId}` : "/console/tests"} className="inline-flex rounded-lg border border-blue-400 px-3.5 py-2 text-xs font-bold text-[#2188ee] transition hover:bg-blue-50">
                          {isAdmin ? "Duyệt" : "Chi tiết"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && tableItems.length === 0 && <div className="px-6 py-14 text-center text-sm text-slate-500">Chưa có dữ liệu để hiển thị.</div>}
            {loading && <div className="px-6 py-14 text-center text-sm text-slate-500">Đang tải dữ liệu...</div>}
          </div>
        </div>

        <aside className="space-y-7">
          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-950">{isAdmin ? "Đề đã gửi theo nhân viên" : "Thống kê của tôi"}</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {creatorStats.length > 0 ? creatorStats.map((item) => (
                <div key={item.name} className="flex items-center gap-3 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2188ee]" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{item.name}</span>
                  <span className="whitespace-nowrap text-sm font-bold text-[#2188ee]">{item.count} đề thi</span>
                </div>
              )) : <p className="py-5 text-center text-sm text-slate-500">Chưa có đề thi.</p>}
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-xl font-bold text-slate-950">Hoạt động gần đây</h2>
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {activities.length > 0 ? activities.map((test) => (
                <div key={`${test.testId}-${test.status}`}>
                  <p className="line-clamp-2 text-sm font-medium text-slate-900">{test.title} — {statusConfig[test.status]?.label || test.status}</p>
                  <p className="mt-1 text-xs text-slate-500">{creatorName(test, profile)} <span className="px-1.5">•</span> {formatRelative(test.reviewedAt || test.submittedAt || test.updatedAt)}</p>
                </div>
              )) : <p className="py-5 text-center text-sm text-slate-500">Chưa có hoạt động mới.</p>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function AdminDashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  return canUseConsole(profile, "tests.view") || profile?.role === "ADMIN"
    ? <AdminDashboardContent />
    : <section className="rounded-2xl border border-slate-200 bg-white p-8"><h1 className="text-2xl font-bold">{t("staffFeature_dashboard")}</h1><p className="mt-3 text-slate-500">{t("staffConsoleWelcome")}</p></section>;
}
export default AdminDashboard;
