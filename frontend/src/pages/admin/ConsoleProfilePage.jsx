import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import StaffDialog from "../../components/admin/StaffDialog";
import StaffPasswordForm from "../../components/admin/StaffPasswordForm";

export default function ConsoleProfilePage() {
  const { profile, logout, handleUnauthorized } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function completed() {
    try { await logout(); } catch { handleUnauthorized(); }
    navigate("/console", { replace: true, state: { passwordChanged: true } });
  }
  return <section className="mx-auto max-w-2xl space-y-6"><h1 className="text-2xl font-bold">{t("staffProfile")}</h1><div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"><dl className="space-y-4">{[["staffName", profile?.displayName], ["staffEmail", profile?.email], ["staffPhone", profile?.phoneNumber]].map(([key, value]) => <div key={key}><dt className="text-sm text-slate-600">{t(key)}</dt><dd className="mt-1 break-words font-semibold">{value || "—"}</dd></div>)}</dl><button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600">{t("staffChangePassword")}</button></div>{open && <StaffDialog title={t("staffChangePassword")} busy={busy} onClose={() => setOpen(false)}><div className="p-6"><StaffPasswordForm onSuccess={completed} onBusyChange={setBusy} /><button type="button" disabled={busy} onClick={() => setOpen(false)} className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">{t("staffCancel")}</button></div></StaffDialog>}</section>;
}
