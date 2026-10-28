import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import { requestStaffPasswordReset, passwordErrorKey } from "../../api/staffPasswords";
import StaffPasswordForm from "../../components/admin/StaffPasswordForm";

export default function StaffPasswordPage({ mode }) {
  const { t } = useLanguage();
  const { user, profile, logout, handleUnauthorized } = useAuth();
  const [loginPath] = useState(() => mode === "change" && profile?.role === "USER" ? "/login" : "/console");
  const [email, setEmail] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  // Capture then remove the secret fragment, including from the browser's current history entry.
  const [credentials] = useState(() => {
    if (mode !== "reset") return null;
    const params = new URLSearchParams(window.location.hash.slice(1));
    return { email: params.get("email") || "", token: params.get("token") || "" };
  });
  useEffect(() => { if (mode === "reset") window.history.replaceState(null, "", window.location.pathname); }, [mode]);
  if (mode === "change" && !user && !done) return <Navigate to="/console" replace />;
  const expired = mode === "change" && profile?.passwordChangeRequired && (!profile?.temporaryPasswordExpiresAt || profile.temporaryPasswordExpiresAt <= now);
  const invalid = mode === "reset" && (!credentials.email || !/^[A-Za-z0-9_-]{43}$/.test(credentials.token));
  async function forgot(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await requestStaffPasswordReset(email.trim()); setDone(true); }
    catch (failure) { setError(passwordErrorKey(failure)); }
    finally { setBusy(false); }
  }
  async function completed() {
    try { await logout(); } catch { handleUnauthorized(); }
    if (mode === "reset") window.history.replaceState(null, "", window.location.pathname);
    setDone(true);
  }
  return <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 text-slate-900"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <h1 className="mb-5 text-2xl font-bold">{t(mode === "forgot" ? "staffForgotPassword" : mode === "reset" ? "staffResetPassword" : "staffChangePassword")}</h1>
    {done ? <p role="status" className="mb-5 text-sm leading-6 text-slate-700">{t(mode === "forgot" ? "staffResetRequested" : "staffPasswordChanged")}</p>
      : mode === "forgot" ? <form onSubmit={forgot} className="mb-5 space-y-4"><p className="text-sm leading-6 text-slate-600">{t("staffForgotHint")}</p><label className="block text-sm font-semibold">{t("staffEmail")} *<input type="email" required maxLength={254} autoComplete="email" value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-blue-600" /></label>{error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}<button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{t(busy ? "staffWorking" : "staffRequestReset")}</button></form>
      : invalid || expired ? <div role="alert" className="mb-5 space-y-4 text-sm text-red-700"><p>{t(expired ? "staffError_STAFF_TEMP_EXPIRED" : "staffError_STAFF_RESET_INVALID")}</p><Link className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline" to="/console/forgot-password">{t("staffRequestReset")}</Link></div>
      : <div className="mb-5">{mode === "change" && profile?.passwordChangeRequired && <p className="mb-4 text-sm leading-6 text-slate-600">{t("staffFirstChangeHint")}</p>}<StaffPasswordForm resetCredentials={mode === "reset" ? credentials : null} onSuccess={completed} onBusyChange={setBusy} /></div>}
    {mode === "change" && !done ? <button type="button" disabled={busy} className="min-h-11 text-sm font-semibold text-blue-700 underline" onClick={async () => { try { await logout(); } catch { handleUnauthorized(); } }}>{t("staffSignOut")}</button> : <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline" to={loginPath}>{t("staffBackToLogin")}</Link>}
    {mode === "reset" && !done && !invalid && <p className="mt-3 text-xs text-slate-500">{t("staffResetLinkHint")}</p>}
  </section></main>;
}
