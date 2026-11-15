import { useState } from "react";
import { useLanguage } from "../../../i18n/LanguageContext";
import { changeStaffPassword, passwordErrorKey, resetStaffPassword } from "../../../api/staff/staffPasswords";

export default function StaffPasswordForm({ resetCredentials, onSuccess, onBusyChange = () => {} }) {
  const { t } = useLanguage();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (newPassword !== confirmation) { setError("staffPasswordMismatch"); return; }
    if (!resetCredentials && oldPassword === newPassword) { setError("staffError_STAFF_PASSWORD_INVALID"); return; }
    setBusy(true); onBusyChange(true); setError("");
    try {
      if (resetCredentials) await resetStaffPassword(resetCredentials.email, resetCredentials.token, newPassword);
      else await changeStaffPassword(oldPassword, newPassword);
      setOldPassword(""); setNewPassword(""); setConfirmation("");
      await onSuccess();
    } catch (failure) { setError(passwordErrorKey(failure)); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <p id="staff-password-rules" className="text-sm leading-6 text-slate-600">{t("staffPasswordRules")}</p>
    {(!resetCredentials ? [["old", "staffOldPassword", oldPassword, setOldPassword], ["new", "staffNewPassword", newPassword, setNewPassword], ["confirm", "staffConfirmPassword", confirmation, setConfirmation]] : [["new", "staffNewPassword", newPassword, setNewPassword], ["confirm", "staffConfirmPassword", confirmation, setConfirmation]]).map(([id, label, value, setter]) => <label key={id} htmlFor={`staff-password-${id}`} className="block text-sm font-semibold">{t(label)} *<span className="relative mt-2 block"><input id={`staff-password-${id}`} type={visible[id] ? "text" : "password"} required maxLength={128} minLength={id === "old" ? undefined : 12} pattern={id === "old" ? undefined : "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"} aria-describedby="staff-password-rules" autoComplete={id === "old" ? "current-password" : "new-password"} value={value} disabled={busy} onChange={(event) => setter(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 py-2 pl-3 pr-11 focus:border-blue-600 focus:outline-blue-600 disabled:bg-slate-50" /><button type="button" aria-label={t(visible[id] ? "staffHidePassword" : "staffShowPassword")} aria-pressed={!!visible[id]} onClick={() => setVisible((current) => ({ ...current, [id]: !current[id] }))} disabled={busy} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{visible[id] ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 3l18 18" /><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1" /><path d="M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>}</svg></button></span></label>)}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
    <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:opacity-50">{t(busy ? "staffWorking" : "staffChangePassword")}</button>
  </form>;
}
