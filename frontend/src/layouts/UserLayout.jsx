// TODO(Member 1): Implement the authenticated user application shell.
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
];

const PAGE_TITLES = {
    "/dashboard": "dashboard",
    "/tests": "testSets",
    "/history": "attemptHistory",
    "/profile": "personalProfile",
};

function NavIcon({ name }) {
    const paths = {
        grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
        book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z"/></>,
        history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
        user: <><circle cx="12" cy="8" r="3"/><path d="M6 20a6 6 0 0 1 12 0"/></>,
    };
    return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">{paths[name]}</svg>;
}

function UserAvatar({ photoUrl, name }) {
    if (photoUrl) {
        return <img src={photoUrl} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />;
    }
    return (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700">
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
    const [signingOut, setSigningOut] = useState(false);
    const name = profile?.displayName || user?.displayName || "Học viên";
    const photoUrl = profile?.photoUrl || user?.photoURL;
    const pageTitle = /^\/full-test\/[^/]+\/result$/.test(location.pathname)
        ? t("detailedResults")
        : PAGE_TITLES[location.pathname] ? t(PAGE_TITLES[location.pathname]) : "CapyTOEIC";

    const handleSignOut = async () => {
        setSigningOut(true);
        await logout();
        navigate("/", { replace: true });
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {mobileOpen && (
                <button type="button" aria-label={t("closeMenu")} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />
            )}

            <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <button type="button" onClick={() => navigate("/dashboard")} className="flex h-20 items-center gap-3 border-b border-slate-100 px-6 text-left">
                    <BrandLogo className="h-11 w-11 rounded-xl border border-sky-100 bg-white" />
                    <span>
            <strong className="block text-lg leading-tight">CapyTOEIC</strong>
          </span>
                </button>

                <nav className="flex-1 space-y-1 px-4 py-6">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => `flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-3 text-sm font-medium transition ${isActive ? "border-sky-500 bg-sky-50 text-sky-600" : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                        >
                            <NavIcon name={item.icon} />
                            {t(item.labelKey)}
                        </NavLink>
                    ))}
                </nav>

                <button type="button" onClick={handleSignOut} disabled={signingOut} className="mx-5 mb-6 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg>
                    {signingOut ? t("signingOut") : t("signOut")}
                </button>
            </aside>

            <div className="lg:pl-64">
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
                        <button type="button" onClick={() => navigate("/profile")} className="flex items-center gap-3 text-left">
                            <UserAvatar photoUrl={photoUrl} name={name} />
                            <span className="hidden sm:block">
                <strong className="block max-w-44 truncate text-sm">{name}</strong>
                <span className="text-xs text-slate-400">{t("learner")}</span>
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
