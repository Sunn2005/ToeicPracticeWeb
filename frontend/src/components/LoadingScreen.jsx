import BrandLogo from "./BrandLogo";
import { useLanguage } from "../i18n/LanguageContext";

function LoadingScreen({ message }) {
  const { t } = useLanguage();
  const loadingMessage = message || t("checkingSession");

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-linear-to-br from-sky-50 via-white to-amber-50 px-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center text-center">
        <div className="brand-loader-frame">
          <BrandLogo
            decorative
            className="h-44 w-44 rounded-full sm:h-52 sm:w-52"
          />
        </div>
        <p className="mt-6 text-xl font-bold tracking-tight text-slate-900">
          CapyTOEIC
        </p>
        <p className="mt-2 text-sm font-medium text-sky-700">
          {loadingMessage}
        </p>
        <div className="mt-5 flex gap-2" aria-hidden="true">
          <span className="brand-loader-dot" />
          <span className="brand-loader-dot" />
          <span className="brand-loader-dot" />
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
