import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../auth/useAuth";
import { useLanguage } from "../../../../i18n/LanguageContext";

import { getPaymentState, retryPayment } from "../../../../api/billing/payments.js";

export default function PaymentResultPage() {
  const { t } = useLanguage();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderCode = params.get("orderCode");
  const validCode = /^\d+$/.test(orderCode || "") && Number.isSafeInteger(Number(orderCode)) && Number(orderCode) > 0;
  const [state, setState] = useState({ code: null, status: "", error: false });
  const [busy, setBusy] = useState(false);
  const status = state.code === orderCode ? state.status : "";
  const loading = validCode && state.code !== orderCode;
  const success = status === "PAID";

  useEffect(() => {
    if (!validCode) return;
    let active = true;
    getPaymentState(orderCode).then((result) => {
      if (active) setState({ code: orderCode, status: result.status, error: false });
    }).catch(() => {
      if (active) setState({ code: orderCode, status: "", error: true });
    });
    return () => { active = false; };
  }, [orderCode, validCode]);

  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await retryPayment(orderCode);
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      const code = error?.body?.code;
      if (code === "PAYMENT_ALREADY_PAID") {
        setState({ code: orderCode, status: "PAID", error: false });
        refreshProfile();
      } else if (code === "PAYMENT_PROCESSING") {
        setState({ code: orderCode, status: "PROCESSING", error: false });
      } else {
        setState({ code: orderCode, status: "", error: true });
      }
      setBusy(false);
    }
  }

  const messageKey = loading ? "proPaymentChecking"
    : state.error ? "proPaymentStateError"
    : status === "PROCESSING" ? "proPaymentProcessing"
    : success ? "proPaymentSuccessDescription"
    : status === "PENDING" ? "proPaymentPending"
    : status === "CANCELLED" || status === "EXPIRED" ? "proPaymentCancelDescription"
    : "proPaymentUnknown";

  useEffect(() => {
    // The Pro badge reads from the profile: refresh it so the newly paid
    // subscription shows up without the user reloading the page.
    if (success) refreshProfile();
  }, [success, refreshProfile]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm ring-1 ring-slate-100" aria-hidden="true">
        {success ? "🎉" : "↩️"}
      </span>
      <h1 className="mt-5 text-2xl font-bold text-slate-950">
        {success ? t("proPaymentSuccessTitle") : t("proPaymentResultTitle")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {t(messageKey)}
      </p>
      {validCode && !loading && !success && status !== "PROCESSING" && (
        <button type="button" onClick={retry} disabled={busy}
          className="mt-6 min-h-11 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-sky-500">
          {t(busy ? "proPaymentChecking" : "proPaymentRetry")}
        </button>
      )}
      {validCode && !loading && (success || status === "PROCESSING") && (
        <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-11 px-6 text-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500">{t("proPaymentCheckAgain")}</button>
      )}
      {!validCode && <button type="button" onClick={() => navigate("/pricing")} className="mt-6 min-h-11 px-6 text-sky-700">{t("proPaymentChoosePlan")}</button>}
      <p className="sr-only" role="status">{t(messageKey)}</p>
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mt-6 min-h-11 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        {t("proBackToDashboard")}
      </button>
    </main>
  );
}
