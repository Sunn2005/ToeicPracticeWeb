import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { changeStaffPassword, passwordErrorKey, resetStaffPassword } from "../../api/staffPasswords";

export default function StaffPasswordForm({ resetCredentials, onSuccess, onBusyChange = () => {} }) {
  const { t } = useLanguage();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
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
    {(!resetCredentials ? [["old", "staffOldPassword", oldPassword, setOldPassword], ["new", "staffNewPassword", newPassword, setNewPassword], ["confirm", "staffConfirmPassword", confirmation, setConfirmation]] : [["new", "staffNewPassword", newPassword, setNewPassword], ["confirm", "staffConfirmPassword", confirmation, setConfirmation]]).map(([id, label, value, setter]) => <label key={id} htmlFor={`staff-password-${id}`} className="block text-sm font-semibold">{t(label)} *<input id={`staff-password-${id}`} type={visible ? "text" : "password"} required maxLength={128} minLength={id === "old" ? undefined : 12} pattern={id === "old" ? undefined : "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"} aria-describedby="staff-password-rules" autoComplete={id === "old" ? "current-password" : "new-password"} value={value} disabled={busy} onChange={(event) => setter(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-blue-600 disabled:bg-slate-50" /></label>)}
    <button type="button" aria-pressed={visible} onClick={() => setVisible(!visible)} className="min-h-11 text-sm font-semibold text-blue-700 underline">{t(visible ? "staffHidePassword" : "staffShowPassword")}</button>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
    <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:opacity-50">{t(busy ? "staffWorking" : "staffChangePassword")}</button>
  </form>;
}
