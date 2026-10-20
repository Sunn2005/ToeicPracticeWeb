import { useLanguage } from "../../i18n/LanguageContext";
import proCrown from "../../assets/pro-crown.png";

export default function ProAvatarBadge({ subscription, large = false }) {
  const { t } = useLanguage();
  if (subscription?.planCode !== "PRO" || subscription?.effective !== true) return null;

  return (
    <span
      role="img"
      aria-label={t("proAccountBadge")}
      title={t("proAccountBadge")}
      className={`pointer-events-none absolute right-0 top-0 flex items-center justify-center rounded-full bg-amber-300 shadow-sm ${large ? "h-9 w-9 sm:h-10 sm:w-10" : "h-6 w-6 translate-x-1/4 -translate-y-1/4"}`}
    >
      <img src={proCrown} alt="" className="h-full w-full object-contain brightness-[0.55]" />
    </span>
  );
}
