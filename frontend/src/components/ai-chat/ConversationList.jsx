import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

function formatConversationTime(timestamp, language, todayLabel) {
  const date = new Date(Number(timestamp));
  if (!timestamp || Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const time = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  if (date.toDateString() === now.toDateString()) return `${todayLabel}, ${time}`;
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m4 20 4.25-1 10.5-10.5a2.12 2.12 0 0 0-3-3L5.25 16 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  );
}

export default function ConversationList({
  conversations,
  activeConversationId,
  status,
  onSelect,
  onDelete,
  onRename,
  canRename = true,
}) {
  const { language, t } = useLanguage();
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState("");

  const cancelEditing = () => {
    if (saving) return;
    setEditingId(null);
    setDraftTitle("");
    setRenameError("");
  };

  const saveTitle = async (event, conversation) => {
    event.preventDefault();
    const title = draftTitle.trim().replace(/\s+/gu, " ");
    if (!title || Array.from(title).length > 60) {
      setRenameError(t("chatRenameInvalid"));
      return;
    }
    if (title === conversation.title) {
      cancelEditing();
      return;
    }
    setSaving(true);
    setRenameError("");
    try {
      await onRename(conversation.id, title);
      setEditingId(null);
      setDraftTitle("");
    } catch {
      setRenameError(t("chatRenameError"));
    } finally {
      setSaving(false);
    }
  };

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
        const editing = conversation.id === editingId;
        return (
          <div
            key={conversation.id}
            className={`group rounded-xl border transition ${
              active
                ? "border-sky-200 bg-sky-50 text-sky-950"
                : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            {editing ? (
              <form className="p-2" onSubmit={(event) => saveTitle(event, conversation)}>
                <label className="sr-only" htmlFor={`chat-title-${conversation.id}`}>
                  {t("chatRenameLabel")}
                </label>
                <input
                  id={`chat-title-${conversation.id}`}
                  autoFocus
                  type="text"
                  value={draftTitle}
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                    setRenameError("");
                  }}
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelEditing();
                    }
                  }}
                  aria-invalid={Boolean(renameError)}
                  aria-describedby={renameError ? `chat-title-error-${conversation.id}` : undefined}
                  disabled={saving}
                  className="h-11 w-full rounded-lg border border-sky-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-100"
                />
                {renameError && (
                  <p id={`chat-title-error-${conversation.id}`} role="alert" className="mt-1 text-xs leading-5 text-red-600">
                    {renameError}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={cancelEditing} disabled={saving} className="min-h-10 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
                    {t("chatRenameCancel")}
                  </button>
                  <button type="submit" disabled={saving || !draftTitle.trim()} className="min-h-10 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white hover:bg-sky-700 disabled:bg-slate-300">
                    {saving ? t("chatRenaming") : t("chatRenameSave")}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  aria-current={active ? "page" : undefined}
                  className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <span className="block truncate text-sm font-bold">{conversation.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {formatConversationTime(conversation.lastMessageAt, language, t("chatToday"))}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(conversation.id);
                    setDraftTitle(conversation.title);
                    setRenameError("");
                  }}
                  disabled={!canRename}
                  aria-label={`${t("chatRenameConversation")} ${conversation.title}`}
                  title={t("chatRenameConversation")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-100 transition hover:bg-sky-100 hover:text-sky-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <PencilIcon />
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
            )}
          </div>
        );
      })}
    </nav>
  );
}
