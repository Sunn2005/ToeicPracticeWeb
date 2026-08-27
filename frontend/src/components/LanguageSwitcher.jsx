import { useLanguage } from "../i18n/LanguageContext";

function LanguageSwitcher({ className = "" }) {
  const { language, setLanguage, toggleLanguage, t } = useLanguage();

  return (
    <div
      className={`shrink-0 ${className}`}
    >
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={`${t("language")}: ${language === "en" ? t("english") : t("vietnamese")}`}
        title={language === "en" ? t("vietnamese") : t("english")}
        className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-sky-700 shadow-sm transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-300 sm:hidden"
      >
        {language.toUpperCase()}
      </button>

      <div
        className="hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:inline-flex"
        role="group"
        aria-label={t("language")}
      >
        {[
          ["en", "EN", t("english")],
          ["vi", "VI", t("vietnamese")],
        ].map(([value, shortLabel, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setLanguage(value)}
            aria-pressed={language === value}
            aria-label={label}
            title={label}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${
              language === value
                ? "bg-sky-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

export default LanguageSwitcher;
