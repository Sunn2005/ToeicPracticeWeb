import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import BrandLogo from "../components/BrandLogo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";

const NAV_ITEMS = [
  { to: "/dashboard", labelKey: "dashboard", icon: "grid" },
  { to: "/tests", labelKey: "testCatalogNav", icon: "book" },
  { to: "/history", labelKey: "attemptHistory", icon: "history" },
  { to: "/profile", labelKey: "profileNav", icon: "user" },
  { to: "/pricing", labelKey: "upgradeProNav", icon: "star" },
];

const PAGE_TITLES = {
  "/dashboard": "dashboard",
  "/tests": "testSets",
  "/history": "attemptHistory",
  "/profile": "personalProfile",
  "/profile/edit": "profileEditBreadcrumb",
  "/pricing": "upgradeProNav",
};

function NavIcon({ name }) {
  const paths = {
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    user: <><circle cx="12" cy="8" r="3"/><path d="M6 20a6 6 0 0 1 12 0"/></>,
    star: <><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.7 6.6 19.6l1.1-6L3.2 9.4l6.1-.8L12 3z"/></>,
  };
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9">{paths[name]}</svg>;
}

function UserAvatar({ photoUrl, name }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full border-2 border-white object-cover shadow-sm" />;
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-sky-100 font-bold text-sky-700 shadow-sm">
      {(name || "U").charAt(0).toUpperCase()}
    </span>
  );
}

export default function UserLayout() {
  const { t } = useLanguage();
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const name = profile?.displayName || user?.displayName || "Học viên";
  const photoUrl = profile?.photoUrl || user?.photoURL;
  const isPro = profile?.subscription?.planCode === "PRO" && profile?.subscription?.effective === true;
  const pageTitle = /^\/full-test\/[^/]+\/result$/.test(location.pathname)
    ? t("detailedResults")
    : PAGE_TITLES[location.pathname] ? t(PAGE_TITLES[location.pathname]) : "CapyTOEIC";

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    // A document navigation cannot be overwritten by the auth guard's redirect
    // when logout clears the user before this async handler resumes.
    window.location.replace("/");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {mobileOpen && (
        <button type="button" aria-label={t("closeMenu")} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />
      )}

      <aside id="user-sidebar" className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-[width,transform] motion-reduce:transition-none lg:translate-x-0 ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className={`flex h-20 shrink-0 items-center gap-2 border-b border-slate-100 px-3 ${sidebarCollapsed ? "lg:flex-col lg:justify-center lg:gap-1 lg:px-0" : ""}`}>
          <button type="button" onClick={() => navigate("/dashboard")} aria-label="CapyTOEIC" className={`flex min-w-0 flex-1 items-center gap-2 text-left ${sidebarCollapsed ? "lg:flex-none lg:justify-center" : ""}`}>
            <BrandLogo className={`h-11 w-11 shrink-0 rounded-xl border border-sky-100 bg-white ${sidebarCollapsed ? "lg:h-8 lg:w-8" : ""}`} />
            <span className={sidebarCollapsed ? "lg:hidden" : undefined}>
              <strong className="block text-lg leading-tight">CapyTOEIC</strong>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={t(sidebarCollapsed ? "expandSidebar" : "collapseSidebar")}
            title={t(sidebarCollapsed ? "expandSidebar" : "collapseSidebar")}
            aria-expanded={!sidebarCollapsed}
            aria-controls="user-sidebar"
            className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 lg:flex ${sidebarCollapsed ? "lg:h-9" : ""}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
              <path d={sidebarCollapsed ? "m13 9 3 3-3 3" : "m16 9-3 3 3 3"} />
            </svg>
          </button>
        </div>

        <nav className={`flex-1 space-y-1 px-4 py-6 ${sidebarCollapsed ? "lg:px-3" : ""}`}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={t(item.labelKey)}
              title={sidebarCollapsed ? t(item.labelKey) : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-3 text-sm font-medium transition ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""} ${isActive ? "border-sky-500 bg-sky-50 text-sky-600" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
            >
              <NavIcon name={item.icon} />
              <span className={sidebarCollapsed ? "lg:sr-only" : undefined}>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" onClick={handleSignOut} disabled={signingOut} aria-label={signingOut ? t("signingOut") : t("signOut")} title={sidebarCollapsed ? t("signOut") : undefined} className={`mx-5 mb-6 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${sidebarCollapsed ? "lg:mx-3 lg:justify-center lg:px-0" : ""}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg>
          <span className={sidebarCollapsed ? "lg:sr-only" : undefined}>{signingOut ? t("signingOut") : t("signOut")}</span>
        </button>
      </aside>

      <div className={`transition-[padding] motion-reduce:transition-none ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label={t("openMenu")}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
            <h1 className="text-lg font-bold sm:text-xl">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <LanguageSwitcher />
            <button type="button" aria-label={t("notifications")} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
            </button>
            <span className="hidden h-8 w-px bg-slate-200 sm:block" />
            <button
              type="button"
              onClick={() => navigate("/profile")}
              aria-label={`${t("personalProfile")}: ${name}${isPro ? `, ${t("proAccountBadge")}` : ""}`}
              className="flex items-center gap-3 rounded-lg py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500"
            >
              <span className="relative inline-flex shrink-0">
                <UserAvatar photoUrl={photoUrl} name={name} />
              </span>
              <span className="hidden sm:block">
                <strong className="block max-w-44 truncate text-sm">{name}</strong>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-medium leading-4 text-blue-800">{t("learner")}</span>
                  {isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-semibold leading-4 text-amber-900">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                        <path d="m12 2.5 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.32l-5.8 3.05 1.1-6.47-4.69-4.58 6.49-.94L12 2.5Z" />
                      </svg>
                      Pro
                    </span>
                  )}
                </span>
              </span>
            </button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-5rem)] p-4 sm:p-7 lg:p-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
