import { useLanguage } from "../../i18n/LanguageContext";

function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`animate-spin text-[#2188ee] ${className}`} fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function LoadingState({ variant = "page", message, className = "" }) {
  const { t } = useLanguage();
  const text = message || t("loading");

  if (variant === "inline") {
    return (
      <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-sm text-slate-500 ${className}`}>
        <Spinner className="h-4 w-4" />
        {text}
      </span>
    );
  }

  if (variant === "card") {
    return (
      <div role="status" aria-live="polite" className={className}>
        <span className="sr-only">{text}</span>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6">
              <div className="h-5 w-20 rounded-full bg-slate-200" />
              <div className="mt-4 h-4 w-3/4 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-full rounded bg-slate-100" />
              <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
              <div className="mt-6 h-9 w-full rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 py-16 text-center ${className}`}>
      <Spinner className="h-8 w-8" />
      <p className="text-sm font-medium text-slate-500">{text}</p>
    </div>
  );
}
