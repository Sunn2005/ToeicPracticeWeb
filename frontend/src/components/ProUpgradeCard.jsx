import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProUpgradeCard() {
  const { t } = useLanguage();

  return (
    <article className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-sky-50 p-6 shadow-sm sm:flex-row sm:items-center sm:p-7">
      <img
        src="/brand/CapyPro.png"
        alt=""
        width={64}
        height={64}
        className="h-16 w-16 shrink-0 rounded-2xl object-contain shadow-sm ring-1 ring-sky-100"
      />
      <div className="min-w-0 flex-1">
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700">{t("proBenefitsBadge")}</span>
        <h2 className="mt-3 text-xl font-bold text-slate-950">{t("proBenefitsTitle")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("proBenefitsDescription")}</p>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-700" aria-label={t("proBenefitsTitle")}>
          <li>✓ {t("proBenefitsChat")}</li>
          <li>✓ {t("proBenefitsAnalysis")}</li>
        </ul>
      </div>
      <Link
        to="/pricing"
        className="shrink-0 rounded-xl bg-sky-600 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-sky-700"
      >
        {t("proUpgradeAccount")}
      </Link>
    </article>
  );
}
