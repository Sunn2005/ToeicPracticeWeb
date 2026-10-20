import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

const MESSAGE_LIMIT = 1_000;

function formatReset(resetAt, language) {
  if (!resetAt) return "";
  const date = new Date(Number(resetAt));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ChatComposer({ onSend, disabled, sending, quota }) {
  const { language, t } = useLanguage();
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const cannotSubmit = disabled || sending || !trimmed;

  const submit = async (event) => {
    event?.preventDefault();
    if (cannotSubmit) return;
    const content = trimmed;
    setValue("");
    try {
      await onSend(content);
    } catch {
      setValue(content);
    }
  };

  const resetTime = formatReset(quota?.nextResetAt, language);

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
      {quota && (
        <p className="mb-2 text-xs text-slate-500">
          {t("chatQuotaRemaining")} <strong className="text-slate-700">{quota.remainingDaily}/{quota.dailyLimit}</strong>
          {resetTime ? ` · ${t("chatQuotaResetsAt")} ${resetTime}` : ""}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100">
        <label htmlFor="capy-chat-message" className="sr-only">{t("chatMessageLabel")}</label>
        <textarea
          id="capy-chat-message"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          maxLength={MESSAGE_LIMIT}
          rows="1"
          disabled={disabled}
          placeholder={disabled ? t("chatReadOnlyPlaceholder") : t("chatMessagePlaceholder")}
          className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={cannotSubmit}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 px-3 text-sm font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white motion-reduce:animate-pulse" aria-label={t("sending")} /> : t("send")}
        </button>
      </div>
      <p className="mt-1 text-right text-[11px] text-slate-400">{value.length}/{MESSAGE_LIMIT}</p>
    </form>
  );
}
