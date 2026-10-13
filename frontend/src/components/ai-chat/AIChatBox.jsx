import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import AttemptQuestionContextPicker from "./AttemptQuestionContextPicker";
import ChatComposer from "./ChatComposer";
import ChatMessageList from "./ChatMessageList";
import ConversationList from "./ConversationList";
import { keepFocusInsideDialog } from "./focusTrap.js";

const ERROR_TRANSLATION_KEYS = {
  PRO_REQUIRED: "chatErrorProRequired",
  CHAT_BLOCKED_DURING_ATTEMPT: "chatErrorDuringAttempt",
  CHAT_RATE_LIMITED: "chatErrorRateLimited",
  CHAT_DAILY_LIMIT_REACHED: "chatErrorDailyLimit",
  CHAT_MESSAGE_INVALID: "chatErrorMessageInvalid",
  CHAT_CONTEXT_INVALID: "chatErrorContextInvalid",
  CONVERSATION_LIMIT_REACHED: "chatErrorConversationLimit",
  AI_UNAVAILABLE: "chatErrorUnavailable",
  CHAT_JOB_TIMEOUT: "chatErrorTimeout",
  ATTEMPT_NOT_COMPLETED: "chatErrorAttemptNotCompleted",
  NOT_FOUND: "chatErrorNotFound",
};

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function DeleteConfirmation({ conversation, busy, onCancel, onConfirm }) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!conversation) return undefined;
    cancelRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      keepFocusInsideDialog(event, dialogRef.current, document.activeElement);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, conversation]);

  if (!conversation) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50 p-5">
      <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-chat-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 id="delete-chat-title" className="text-lg font-bold text-slate-950">{t("chatDeleteTitle")}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("chatDeleteDescription")}</p>
        <div className="mt-5 flex gap-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{t("cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:bg-red-300">{busy ? t("deleting") : t("delete")}</button>
        </div>
      </section>
    </div>
  );
}

export default function AIChatBox({
  open,
  onClose,
  chat,
  attempts = [],
  getQuestionChoices,
}) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const deleteTargetRef = useRef(deleteTarget);

  useEffect(() => {
    deleteTargetRef.current = deleteTarget;
  }, [deleteTarget]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !deleteTargetRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      keepFocusInsideDialog(event, dialogRef.current, document.activeElement, {
        suspended: Boolean(deleteTargetRef.current),
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;

  const activeConversation = chat.conversations.find(({ id }) => id === chat.activeConversationId);
  const errorText = chat.errorCode
    ? t(ERROR_TRANSLATION_KEYS[chat.errorCode] || "chatErrorGeneric")
    : chat.errorMessage;
  const blockedDuringAttempt = chat.errorCode === "CHAT_BLOCKED_DURING_ATTEMPT";

  const create = async (context) => {
    try {
      await chat.startConversation(context);
      setCreating(false);
      setShowHistory(false);
    } catch {
      // The hook exposes the stable backend error in the panel.
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await chat.removeConversation(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // The hook exposes the stable backend error in the panel.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] sm:pointer-events-none">
      <button type="button" onClick={onClose} aria-label={t("closeChat")} className="absolute inset-0 bg-slate-950/45 sm:pointer-events-auto sm:bg-transparent" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="capy-chat-title"
        className="pointer-events-auto absolute inset-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(680px,calc(100dvh-7rem))] sm:w-[min(720px,calc(100vw-2.5rem))] sm:rounded-3xl sm:border sm:border-slate-200"
      >
        <header className="flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            aria-expanded={showHistory}
            aria-controls="capy-chat-history"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:hidden"
          >
            <MenuIcon />
            <span className="sr-only">{t("chatConversationHistory")}</span>
          </button>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-emerald-100 text-xl" aria-hidden="true">🦫</span>
          <div className="min-w-0 flex-1">
            <h2 id="capy-chat-title" className="truncate font-bold text-slate-950">{t("chatTitle")}</h2>
            <p className="truncate text-xs text-slate-500">{activeConversation?.title || t("chatSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setShowHistory(false);
            }}
            disabled={creating}
            className="min-h-11 rounded-xl border border-sky-200 px-3 text-sm font-bold text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("new")}
          </button>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t("closeChat")} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
            <CloseIcon />
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1">
          <aside
            id="capy-chat-history"
            className={`${showHistory ? "absolute inset-0 z-10 flex" : "hidden"} w-full flex-col border-r border-slate-200 bg-white sm:static sm:flex sm:w-60`}
          >
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{t("chatConversationHistory")}</div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationList
                conversations={chat.conversations}
                activeConversationId={chat.activeConversationId}
                status={chat.status}
                onSelect={(id) => {
                  setCreating(false);
                  setShowHistory(false);
                  void chat.openConversation(id).catch(() => undefined);
                }}
                onDelete={setDeleteTarget}
              />
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
            {errorText && (
              <div role="alert" className="flex items-start justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span className="min-w-0 flex-1">{errorText}{chat.errorCode ? ` (${chat.errorCode})` : ""}</span>
                <span className="flex shrink-0 flex-col items-end gap-2 sm:flex-row">
                  {blockedDuringAttempt && (
                    <Link to="/history" onClick={onClose} className="font-bold underline">
                      {t("chatViewAttemptHistory")}
                    </Link>
                  )}
                  <button type="button" onClick={chat.clearError} className="font-bold underline">{t("dismiss")}</button>
                </span>
              </div>
            )}
            {!chat.canSend && (
              <p className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{t("chatReadOnlyNotice")}</p>
            )}
            {creating || !activeConversation ? (
              <AttemptQuestionContextPicker
                attempts={attempts}
                getQuestionChoices={getQuestionChoices}
                onCreate={create}
                creating={chat.sending}
                disabled={!chat.canSend}
              />
            ) : (
              <>
                <ChatMessageList messages={chat.messages} onRetry={chat.retryMessage} canRetry={chat.canSend && !chat.sending} />
                <ChatComposer onSend={chat.sendMessage} disabled={!chat.canSend} sending={chat.sending} quota={chat.quota} />
              </>
            )}
          </main>
        </div>

        <DeleteConfirmation
          conversation={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      </section>
    </div>
  );
}
