import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";

export default function PaymentResultPage({ mode }) {
  const { t } = useLanguage();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const success = mode === "success";

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
        {success ? t("proPaymentSuccessTitle") : t("proPaymentCancelTitle")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {success ? t("proPaymentSuccessDescription") : t("proPaymentCancelDescription")}
      </p>
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
