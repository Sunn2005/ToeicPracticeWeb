import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useLanguage } from "../i18n/LanguageContext";

const iconPaths = {
  dashboard: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  tests: ["M7 3h7l4 4v14H7z", "M14 3v5h5M10 13h6M10 17h6"],
  create: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 8v8M8 12h8"],
  review: ["M7 4h10v17H7zM9 4V2h6v2", "m9 13 2 2 4-5"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5M12 7v6l4 2"],
  logout: ["M10 17l5-5-5-5M15 12H3", "M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"],
  lock: ["M7 10h10v10H7zM9 10V7a3 3 0 0 1 6 0v3"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  close: ["m6 6 12 12M18 6 6 18"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"],
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
  const { profile, role, logout } = useAuth();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = role === "ADMIN";

  const navigation = [
    { label: "Trang tổng quan", icon: "dashboard", to: "/console/dashboard" },
    { label: "Quản lý đề thi", icon: "tests", to: "/console/tests", badge: "EMP" },
    { label: "Tạo đề mới", icon: "create", to: "/console/tests/new", badge: "EMP" },
    { label: "Xét duyệt", icon: "review", to: "/console/reviews", locked: !isAdmin },
    { label: "Lịch sử phê duyệt", icon: "history", to: "/console/review-history", locked: !isAdmin },
    ...(isAdmin ? [{ label: t("adminSubscriptionNav"), icon: "lock", to: "/console/subscriptions" }] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/console", { replace: true });
  };

  const sidebar = (
      <div className="flex h-full flex-col bg-white">
        <div className="flex h-20 items-center justify-between border-b border-slate-100 px-6">
          <NavLink to="/console/dashboard" className="flex items-center gap-3 text-lg font-bold text-[#2188ee]">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#2188ee] text-xl font-bold text-white">T</span>
            <span className="whitespace-nowrap">TOEIC Master</span>
          </NavLink>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Đóng menu">
            <Icon name="close" />
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-6" aria-label="Điều hướng Console">
          {navigation.map((item) => item.locked ? (
              <div key={item.label} aria-disabled="true" title="Chỉ quản trị viên được truy cập" className="flex h-12 cursor-not-allowed items-center gap-3 rounded-xl px-4 text-sm font-medium text-slate-400">
                <Icon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                <Icon name="lock" className="h-4 w-4" />
              </div>
          ) : (
              <NavLink key={item.label} to={item.to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${isActive ? "bg-blue-50 text-[#2188ee]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                <Icon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {item.badge && <span className="text-[10px] font-bold tracking-wider text-slate-500">{item.badge}</span>}
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
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-10">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden" aria-label="Mở menu">
              <Icon name="menu" />
            </button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3 sm:gap-5">
              <button type="button" className="relative grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600" aria-label="Thông báo">
                <Icon name="bell" />
                {isAdmin && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
              </button>
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
