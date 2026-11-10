import { useAuth } from "./useAuth";
import { useLanguage } from "../i18n/LanguageContext";

export default function SessionRecovery() {
  const { authLoading, profileLoading, retrySession } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
      <p role="status">{t(authLoading ? "checkingSession" : "authSessionUnavailable")}</p>
      <button
        type="button"
        onClick={retrySession}
        disabled={authLoading || profileLoading}
        className="mt-2 min-h-11 rounded-lg px-4 font-semibold text-sky-800 underline focus-visible:outline-2 focus-visible:outline-sky-600 disabled:cursor-wait disabled:opacity-60"
      >
        {t("retry")}
      </button>
    </div>
  );
}
