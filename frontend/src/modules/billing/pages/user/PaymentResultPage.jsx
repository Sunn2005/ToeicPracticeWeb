import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../../auth/useAuth";
import { useLanguage } from "../../../../i18n/LanguageContext";

import { confirmPayment, retryPayment } from "../../../../api/billing/payments.js";

export default function PaymentResultPage() {
  const { t } = useLanguage();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const orderCode = params.get("orderCode");
  const validCode = /^\d+$/.test(orderCode || "") && Number.isSafeInteger(Number(orderCode)) && Number(orderCode) > 0;
  const [state, setState] = useState({ code: null, status: "", error: false });
  const [busy, setBusy] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const status = state.code === orderCode ? state.status : "";
  const loading = validCode && state.code !== orderCode;
  const success = status === "PAID";

  useEffect(() => {
    if (!validCode) return;
    let active = true;
    let timer;
    let checks = 0;
    async function check() {
      try {
        const result = await confirmPayment(orderCode);
        if (!active) return;
        // Confirmation must persist Pro before /api/me is reloaded. Never
        // announce success from the redirect query or a read-only status check.
        if (result.status === "PAID") await refreshProfile();
        if (!active) return;
        setState({ code: orderCode, status: result.status, error: false });
        checks += 1;
        if (["PENDING", "PROCESSING"].includes(result.status) && checks < 10) {
          timer = window.setTimeout(check, 3000);
        }
      } catch {
        if (active) setState({ code: orderCode, status: "", error: true });
      }
    }
    check();
    return () => { active = false; window.clearTimeout(timer); };
  }, [orderCode, validCode, refreshProfile, checkVersion]);

  function checkAgain() {
    setState({ code: null, status: "", error: false });
    setCheckVersion((version) => version + 1);
  }

  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await retryPayment(orderCode);
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      const code = error?.body?.code;
      if (code === "PAYMENT_ALREADY_PAID") {
        checkAgain();
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
      {validCode && !loading && (
        <button type="button" onClick={checkAgain} disabled={busy} className="mt-6 min-h-11 px-6 text-sky-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-sky-500">{t("proPaymentCheckAgain")}</button>
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
