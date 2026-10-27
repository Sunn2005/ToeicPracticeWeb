import { useEffect, useRef } from "react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function StaffDialog({ title, onClose, busy, children }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  const { t } = useLanguage();
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby="staff-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) close.current(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40">
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5"><h2 id="staff-dialog-title" className="text-xl font-bold">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label={t("staffClose")} className="grid h-11 w-11 place-items-center rounded-xl text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-blue-600 disabled:opacity-40">×</button></div>
    {children}
  </dialog>;
}
