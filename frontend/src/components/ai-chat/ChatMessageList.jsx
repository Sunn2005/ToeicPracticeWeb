import { useEffect, useRef } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

function PendingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span
          key={dot}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 motion-reduce:animate-pulse"
          style={{ animationDelay: `${dot * 120}ms` }}
        />
      ))}
    </span>
  );
}

export default function ChatMessageList({ messages, onRetry, canRetry }) {
  const { t } = useLanguage();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
        <div className="max-w-xs">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-2xl" aria-hidden="true">💬</span>
          <p className="mt-4 font-bold text-slate-800">{t("chatEmptyTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{t("chatEmptyDescription")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
    >
      {messages.map((message) => {
        const fromUser = message.role === "USER";
        return (
          <article key={message.id} className={`flex ${fromUser ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
              fromUser
                ? "rounded-br-md bg-sky-600 text-white"
                : message.status === "FAILED"
                  ? "rounded-bl-md border border-red-200 bg-red-50 text-red-900"
                  : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
            }`}>
              {message.status === "PENDING" ? (
                <div role="status" className="flex items-center gap-2 text-slate-500">
                  <PendingDots />
                  <span>{t("chatAssistantThinking")}</span>
                </div>
              ) : message.status === "FAILED" ? (
                <div>
                  <p>{t("chatMessageFailed")}</p>
                  {message.errorCode && <p className="mt-1 text-xs font-semibold">{message.errorCode}</p>}
                  <button
                    type="button"
                    onClick={() => void onRetry(message.id).catch(() => undefined)}
                    disabled={!canRetry}
                    className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("retry")}
                  </button>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
          </article>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
