import { useLanguage } from "../../i18n/LanguageContext";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
    </svg>
  );
}

export default function ConversationList({
  conversations,
  activeConversationId,
  status,
  onSelect,
  onDelete,
}) {
  const { t } = useLanguage();

  if (status === "loading") {
    return (
      <div role="status" className="space-y-2 p-3" aria-label={t("chatLoadingConversations")}>
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  if (!conversations.length) {
    return <p className="px-4 py-6 text-center text-sm leading-6 text-slate-500">{t("chatNoConversations")}</p>;
  }

  return (
    <nav aria-label={t("chatConversationHistory")} className="space-y-1 p-2">
      {conversations.map((conversation) => {
        const active = conversation.id === activeConversationId;
        return (
          <div
            key={conversation.id}
            className={`group flex items-center gap-1 rounded-xl border transition ${
              active
                ? "border-sky-200 bg-sky-50 text-sky-950"
                : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={active ? "page" : undefined}
              className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <span className="block truncate text-sm font-bold">{conversation.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {conversation.contextQuestionNumber
                  ? `${t("question")} ${conversation.contextQuestionNumber}`
                  : t("chatGeneralToeic")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(conversation)}
              aria-label={`${t("delete")} ${conversation.title}`}
              title={t("delete")}
              className="mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <TrashIcon />
            </button>
          </div>
        );
      })}
    </nav>
  );
}
