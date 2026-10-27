import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../i18n/LanguageContext";
import BrandLogo from "../components/BrandLogo.jsx";

const NAV_ITEMS = [
    { to: "/#features", labelKey: "publicNavFeatures" },
    { to: "/#tests", labelKey: "publicNavTests" },
    { to: "/#pro", labelKey: "publicNavPro" },
];

const FOOTER_COURSES = [
    { to: "/#tests", labelKey: "publicFooterCourse1" },
    { to: "/#tests", labelKey: "publicFooterCourse2" },
    { to: "/#pro", labelKey: "publicFooterCourse3" },
];

const FOOTER_EXPLORE = [
    { to: "/#features", labelKey: "publicFooterExplore1" },
    { to: "/login", labelKey: "publicFooterExplore2" },
];

function Logo({ light = false }) {
    const { t } = useLanguage();
    return (
        <span className="flex items-center gap-3">
            <BrandLogo className="h-11 w-11 rounded-xl border border-sky-100 bg-white" />
            <span>
                <strong className={`block text-lg leading-tight ${light ? "text-white" : "text-slate-900"}`}>
                    CapyTOEIC
                </strong>
                <span className={`block text-sm ${light ? "text-slate-400" : "text-slate-500"}`}>
                    {t("smarterPractice")}
                </span>
            </span>
        </span>
    );
}

function SocialIcon({ name }) {
    const paths = {
        facebook: <path d="M14 8h2V5h-2.5A3.5 3.5 0 0 0 10 8.5V11H8v3h2v6h3v-6h2.2l.5-3H13V8.7c0-.4.3-.7.7-.7H14z" />,
        youtube: <path d="M21 8.2a2.5 2.5 0 0 0-1.8-1.8C17.7 6 12 6 12 6s-5.7 0-7.2.4A2.5 2.5 0 0 0 3 8.2 26 26 0 0 0 2.6 12c0 1.3.1 2.6.4 3.8a2.5 2.5 0 0 0 1.8 1.8C6.3 18 12 18 12 18s5.7 0 7.2-.4a2.5 2.5 0 0 0 1.8-1.8c.3-1.2.4-2.5.4-3.8s-.1-2.6-.4-3.8zM10 14.5v-5l4.3 2.5-4.3 2.5z" />,
        linkedin: <path d="M6.5 9H4v10h2.5V9zM5.2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM20 19v-5.5c0-2.4-1.3-3.6-3.1-3.6-1.4 0-2.1.8-2.4 1.3V9H12v10h2.5v-5.6c0-1.2.7-1.9 1.6-1.9s1.4.7 1.4 1.9V19H20z" />,
    };
    return (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            {paths[name]}
        </svg>
    );
}

export default function PublicLayout() {
    const { t } = useLanguage();
    const [menuOpen, setMenuOpen] = useState(false);
    const { pathname, hash } = useLocation();

    // Router links like "/#tests" do not scroll by themselves.
    useEffect(() => {
        if (hash) {
            document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        } else {
            window.scrollTo(0, 0);
        }
    }, [pathname, hash]);

    return (
        <div className="flex min-h-screen min-h-dvh flex-col bg-white text-slate-900">
            <a href="#public-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:text-sky-700">{t("publicSkipContent")}</a>
            <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
                <div className="flex w-full items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
                    <Link to="/" aria-label="CapyTOEIC">
                        <Logo />
                    </Link>

                    <nav className="hidden items-center gap-2 md:flex" aria-label={t("publicNavLabel")}>
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.labelKey}
                                to={item.to}
                                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700"
                            >
                                {t(item.labelKey)}
                            </Link>
                        ))}
                        <LanguageSwitcher className="mx-1" />
                        <Link
                            to="/login"
                            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
                        >
                            {t("publicNavLogin")}
                        </Link>
                    </nav>

                    <button
                        type="button"
                        className="min-h-11 min-w-11 rounded-lg border border-slate-200 p-2 text-slate-600 md:hidden"
                        aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            {menuOpen ? <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
                        </svg>
                    </button>
                </div>

                {menuOpen && (
                    <nav className="border-t border-slate-100 px-4 py-3 md:hidden" aria-label={t("publicNavLabel")}>
                        <div className="flex flex-col gap-1">
                            {NAV_ITEMS.map((item) => (
                                <Link
                                    key={item.labelKey}
                                    to={item.to}
                                    onClick={() => setMenuOpen(false)}
                                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-sky-50"
                                >
                                    {t(item.labelKey)}
                                </Link>
                            ))}
                            <div className="mt-2 flex items-center gap-2.5 border-t border-slate-100 pt-3">
                                <LanguageSwitcher />
                                <Link
                                    to="/login"
                                    onClick={() => setMenuOpen(false)}
                                    className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm"
                                >
                                    {t("publicNavLogin")}
                                </Link>
                            </div>
                        </div>
                    </nav>
                )}
            </header>

            <main id="public-main" className="flex-1">
                <Outlet />
            </main>

            <footer className="bg-[#111827] text-slate-300">
                <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
                    <div>
                        <Logo light />
                        <p className="mt-4 max-w-xs text-xs leading-5 text-slate-400">{t("publicFooterTagline")}</p>
                        <div className="mt-5 flex gap-4 text-slate-400">
                            {["facebook", "youtube", "linkedin"].map((name) => (
                                <span key={name} className="transition hover:text-white"><SocialIcon name={name} /></span>
                            ))}
                        </div>
                    </div>
                    <nav aria-label={t("publicFooterCourses")}>
                        <p className="text-xs font-bold text-white">{t("publicFooterCourses")}</p>
                        <ul className="mt-4 space-y-3 text-xs text-slate-400">
                            {FOOTER_COURSES.map((item) => (
                                <li key={item.labelKey}><Link to={item.to} className="hover:text-white">{t(item.labelKey)}</Link></li>
                            ))}
                        </ul>
                    </nav>
                    <nav aria-label={t("publicFooterExplore")}>
                        <p className="text-xs font-bold text-white">{t("publicFooterExplore")}</p>
                        <ul className="mt-4 space-y-3 text-xs text-slate-400">
                            {FOOTER_EXPLORE.map((item) => (
                                <li key={item.labelKey}><Link to={item.to} className="hover:text-white">{t(item.labelKey)}</Link></li>
                            ))}
                        </ul>
                    </nav>
                </div>
                <div className="border-t border-slate-700/60">
                    <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-slate-400 sm:px-6">
                        © 2026 CapyTOEIC. {t("publicFooterRights")}
                    </p>
                </div>
            </footer>
        </div>
    );
}
