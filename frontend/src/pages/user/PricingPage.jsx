import { useEffect, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import { createProPayment, getProPlans } from "../../api/payments.js";

function formatVND(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(language, timestamp) {
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

function BenefitsList({ t }) {
  return (
    <ul className="mt-4 space-y-2 text-sm font-semibold text-slate-700">
      <li>✓ {t("proBenefitsChat")}</li>
      <li>✓ {t("proBenefitsAnalysis")}</li>
    </ul>
  );
}

function TrustSignals({ t }) {
  const items = [
    { key: "secure", label: t("pricingTrustSecure"), path: <path d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v10H5zM12 15v2" /> },
    { key: "instant", label: t("pricingTrustInstant"), path: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /> },
    { key: "no-renew", label: t("pricingTrustNoRenew"), path: <><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></> },
  ];
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-sky-600" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{item.path}</svg>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [payingPlan, setPayingPlan] = useState("");
  const [error, setError] = useState("");

  const subscription = profile?.subscription;
  const proActive = Boolean(subscription?.effective);

  useEffect(() => {
    getProPlans()
      .then((loaded) => setPlans(loaded || []))
      .catch(() => setError(t("proPlansLoadError")))
      .finally(() => setLoadingPlans(false));
  }, [t]);

  async function pay(plan) {
    if (payingPlan) return;
    setPayingPlan(plan.planCode);
    setError("");
    try {
      const result = await createProPayment(plan.planCode);
      window.location.assign(result.checkoutUrl);
    } catch (err) {
      setError(
        err?.body?.code === "PAYMENT_TRIAL_ALREADY_USED"
          ? t("proPaymentTrialUsed")
          : t("proPaymentError"),
      );
      setPayingPlan("");
    }
  }

  const trial = plans.find((plan) => plan.trial);
  const monthly = plans.find((plan) => !plan.trial);
  const orderedPlans = [trial, monthly].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-center gap-4 text-center">
        <img
          src="/brand/CapyPro.png"
          alt=""
          width={80}
          height={80}
          className="h-20 w-20 rounded-3xl object-contain shadow-sm ring-1 ring-sky-100"
        />
        <div>
          <h2 className="text-2xl font-bold text-slate-950">{t("pricingTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t("pricingSubtitle")}</p>
        </div>
      </div>

      {proActive && (
        <p className="mt-6 rounded-xl bg-sky-50 px-4 py-3 text-center text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
          {t("pricingCurrentPro")}
          {subscription.expiresAt ? ` ${formatDate(language, subscription.expiresAt)}` : ""}
        </p>
      )}

      {loadingPlans && <p className="mt-8 text-center text-sm text-slate-500">{t("loading")}</p>}

      {error && <p role="alert" className="mx-auto mt-6 max-w-xl rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</p>}

      {!loadingPlans && (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {orderedPlans.map((plan) => {
            const isTrial = plan.trial;
            const trialUsed = isTrial && plan.trialUsed;
            const paying = payingPlan === plan.planCode;
            return (
              <article
                key={plan.planCode}
                className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-sm sm:p-7 ${
                  isTrial ? "border border-slate-200" : "border-2 border-sky-500"
                } ${trialUsed ? "opacity-70" : ""}`}
              >
                {!isTrial && (
                  <span className="absolute -top-3 left-6 rounded-full bg-sky-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    {t("pricingPopular")}
                  </span>
                )}
                {isTrial && (
                  <span className="w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-700">
                    {trialUsed ? t("proPlanTrialUsed") : t("pricingTrialBadge")}
                  </span>
                )}
                <h3 className="mt-3 text-lg font-bold text-slate-950">
                  {isTrial ? t("pricingTrialName") : t("pricingMonthlyName")}
                </h3>
                <p className="mt-3">
                  <span className="text-4xl font-extrabold text-slate-950">{formatVND(plan.amount)}</span>
                  <span className="ml-2 text-sm font-medium text-slate-500">
                    / {plan.durationDays} {plan.durationDays === 1 ? t("day") : t("days")}
                  </span>
                </p>
                {!isTrial && (
                  <p className="mt-1 text-sm text-slate-500">
                    {t("pricingOnly")} ~{formatVND(Math.round(plan.amount / plan.durationDays))}/{t("day")}
                  </p>
                )}
                {isTrial && <p className="mt-1 text-sm text-slate-500">{t("pricingTrialNote")}</p>}
                <BenefitsList t={t} />
                <button
                  type="button"
                  onClick={() => pay(plan)}
                  disabled={payingPlan !== "" || trialUsed}
                  className={`mt-6 w-full rounded-xl px-6 py-3 text-sm font-bold transition disabled:cursor-not-allowed ${
                    isTrial
                      ? "border border-sky-600 text-sky-700 hover:bg-sky-50 disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
                      : "bg-sky-600 text-white hover:bg-sky-700 disabled:bg-sky-300"
                  }`}
                >
                  {paying ? t("proPaying") : isTrial ? t("pricingTryNow") : `${t("proPayNow")} ${formatVND(plan.amount)}`}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <TrustSignals t={t} />
    </div>
  );
}
