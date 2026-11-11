import { canUseConsole, consoleRoutePermission } from "../auth/consolePermissions";
import { useEffect, useState } from "react";
import { Link, matchPath, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import BrandLogo from "../components/ui/BrandLogo";
import { useLanguage } from "../i18n/LanguageContext";

const iconPaths = {
  dashboard: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  staff: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87", "M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  tests: ["M7 3h7l4 4v14H7z", "M14 3v5h5M10 13h6M10 17h6"],
  create: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8v8M8 12h8"],
  review: ["M7 4h10v17H7zM9 4V2h6v2", "m9 13 2 2 4-5"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5M12 7v6l4 2"],
  logout: ["M10 17l5-5-5-5M15 12H3", "M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"],
  revenue: ["M3 3v18h18", "m6 15 5-5 4 3 5-6"],
  orders: ["M5 8h14l1 13H4L5 8Z", "M9 8V6a3 3 0 0 1 6 0v2"],
  profile: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  close: ["m6 6 12 12M18 6 6 18"],
};

function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {iconPaths[name].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

function initials(profile) {
  const source = profile?.displayName || profile?.email || "NV";
  return source.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
}

function ManagementLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, role, logout, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = role === "ADMIN";

  const navigation = [
    { label: "Trang tổng quan", icon: "dashboard", to: "/console/dashboard" },
    { label: t("staffTitle"), icon: "staff", to: "/console/staff" },
    { label: "Quản lý đề thi", icon: "tests", to: "/console/tests" },
    { label: "Tạo đề mới", icon: "create", to: "/console/tests/new" },
    { label: "Xét duyệt", icon: "review", to: "/console/reviews" },
    { label: "Lịch sử phê duyệt", icon: "history", to: "/console/review-history" },
    { label: t("adminRevenueNav"), icon: "revenue", to: "/console/revenue" },
    { label: t("adminOrdersNav"), icon: "orders", to: "/console/orders" },
    { label: t("staffProfile"), icon: "profile", to: "/console/profile" },
  ].filter((item) => canUseConsole(profile, consoleRoutePermission(item.to)));
  const breadcrumb = navigation.filter(({ to }) => matchPath({ path: to, end: false }, pathname));
  const detailLabel = [
    ["/console/tests/:testId/edit", "consoleEditTest"],
    ["/console/tests/:testId/preview", "consolePreviewTest"],
    ["/console/reviews/:testId", "consoleReviewDetails"],
  ].find(([path]) => matchPath(path, pathname))?.[1];

  useEffect(() => {
    const refresh = () => { refreshProfile().catch(() => {}); };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refreshProfile, pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/console", { replace: true });
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
        <NavLink to="/console/dashboard" className="flex items-center gap-3 text-lg font-bold text-[#2188ee]">
          <BrandLogo decorative className="h-11 w-11 shrink-0" />
          <span className="whitespace-nowrap">CapyTOEIC</span>
        </NavLink>
        <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Đóng menu">
          <Icon name="close" />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 px-4 py-6" aria-label="Điều hướng quản trị">
        {navigation.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${isActive ? "bg-blue-50 text-[#2188ee]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
            <Icon name={item.icon} />
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <button type="button" onClick={handleLogout} className="flex h-12 w-full items-center gap-3 rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600">
          <Icon name="logout" />
          Đăng xuất
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f8fc] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-70 border-r border-slate-200 lg:block">{sidebar}</aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Đóng menu" onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" />
          <aside className="relative h-full w-[min(19rem,86vw)] shadow-2xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-70">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-10">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden" aria-label="Mở menu">
            <Icon name="menu" />
          </button>
          <nav aria-label={t("consoleBreadcrumb")} className="min-w-0 text-sm">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {breadcrumb.map((item, index) => {
                const current = index === breadcrumb.length - 1 && !detailLabel;
                return (
                  <li key={item.to} className="flex items-center gap-2">
                    {index > 0 && <span aria-hidden="true" className="text-slate-400">/</span>}
                    {current
                      ? <span aria-current="page" className="font-semibold text-slate-900">{item.label}</span>
                      : <Link to={item.to} className="text-slate-600 hover:underline">{item.label}</Link>}
                  </li>
                );
              })}
              {detailLabel && (
                <li aria-current="page" className="flex items-center gap-2 font-semibold text-slate-900">
                  {breadcrumb.length > 0 && <span aria-hidden="true" className="text-slate-400">/</span>}
                  {t(detailLabel)}
                </li>
              )}
            </ol>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
            <div className="hidden text-right sm:block">
              <p className="max-w-52 truncate text-sm font-bold text-slate-900">{profile?.displayName || profile?.email || "Tài khoản nội bộ"}</p>
              <p className="mt-0.5 text-xs text-slate-500">{isAdmin ? "Quản trị viên" : "Nhân viên"}</p>
            </div>
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt="" className="h-11 w-11 rounded-full border-2 border-white object-cover shadow" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{initials(profile)}</span>
            )}
          </div>
        </header>

        <main className="min-h-[calc(100vh-5rem)] p-4 sm:p-7 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default ManagementLayout;
