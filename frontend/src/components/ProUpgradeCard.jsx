import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { createProPayment, getProPlans } from "../api/payments";

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProUpgradeCard() {
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState("");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProPlans()
      .then((loaded) => {
        setPlans(loaded || []);
        setSelected(loaded?.[0]?.planCode || "");
      })
      .catch(() => setError(t("proPlansLoadError")))
      .finally(() => setLoadingPlans(false));
  }, [t]);

  async function pay() {
    if (!selected || paying) return;
    setPaying(true);
    setError("");
    try {
      const result = await createProPayment(selected);
      window.location.href = result.checkoutUrl;
    } catch {
      setError(t("proPaymentError"));
      setPaying(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-sky-50 p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-violet-100" aria-hidden="true">🦫</span>
        <div>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-violet-700">{t("proBenefitsBadge")}</span>
          <h2 className="mt-3 text-xl font-bold text-slate-950">{t("proBenefitsTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("proBenefitsDescription")}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-slate-700" aria-label={t("proBenefitsTitle")}>
            <li>✓ {t("proBenefitsChat")}</li>
            <li>✓ {t("proBenefitsAnalysis")}</li>
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-slate-800">{t("proChoosePlan")}</p>
        {loadingPlans && <p className="mt-2 text-sm text-slate-500">{t("loading")}</p>}
        {!loadingPlans && plans.map((plan) => (
          <label key={plan.planCode} className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <input
              type="radio"
              name="pro-plan"
              value={plan.planCode}
              checked={selected === plan.planCode}
              onChange={() => setSelected(plan.planCode)}
              className="accent-violet-600"
            />
            <span className="text-sm font-semibold text-slate-800">
              {plan.durationDays} {plan.durationDays === 1 ? t("day") : t("days")} · {formatVND(plan.amount)}
              {plan.sandboxOnly ? ` · ${t("proPlanTest")}` : ""}
            </span>
          </label>
        ))}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="button"
          onClick={pay}
          disabled={paying || !selected}
          className="mt-4 min-h-11 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-violet-300"
        >
          {paying ? t("proPaying") : t("proPayNow")}
        </button>
      </div>
    </article>
  );
}
