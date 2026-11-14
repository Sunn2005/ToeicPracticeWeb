import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { useLanguage } from "../../../i18n/LanguageContext";
import { updateProfile } from "../../../api/me.js";
import { getPendingSubmissions, getReviewHistory } from "../../../api/tests/adminReviews.js";
import StaffDialog from "../../staff-management/components/StaffDialog";
import StaffPasswordForm from "../../authentication/components/StaffPasswordForm";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
const ringFields = ["displayName", "email", "phoneNumber", "dateOfBirth"];

function CompletionRing({ profile, t }) {
  const filled = ringFields.filter((field) => profile?.[field]).length;
  const percent = Math.round(filled / ringFields.length * 100);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  return <div className="flex items-center gap-5">
    <svg width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`${t("staffProfileCompletion")}: ${percent}%`} className="shrink-0 text-slate-900">
      <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="10" className="stroke-slate-200" />
      <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circumference * percent / 100} ${circumference}`} className="stroke-blue-600" />
      <text x="64" y="64" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="700" fill="currentColor">{`${percent}%`}</text>
    </svg>
    <div><h2 className="font-bold">{t("staffProfileCompletion")}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{t("staffProfileCompletionHelp").replace("{filled}", filled).replace("{total}", ringFields.length)}</p></div>
  </div>;
}

function ReviewStats({ t }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getReviewHistory(), getPendingSubmissions()]).then(
      ([history, queue]) => {
        if (cancelled) return;
        const historyList = Array.isArray(history) ? history : history?.items ?? [];
        const queueList = Array.isArray(queue) ? queue : queue?.items ?? [];
        setStats({
          approved: historyList.filter((item) => item.status === "APPROVED").length,
          rejected: historyList.filter((item) => item.status === "REJECTED").length,
          pending: queueList.length,
        });
      },
      () => { if (!cancelled) setStats({ approved: null, rejected: null, pending: null }); },
    );
    return () => { cancelled = true; };
  }, []);
  const cards = [
    ["staffStatsApproved", stats?.approved],
    ["staffStatsRejected", stats?.rejected],
    ["staffStatsPending", stats?.pending],
  ];
  return <section aria-labelledby="profile-stats-title" className="rounded-2xl border border-slate-200 bg-white p-6">
    <h2 id="profile-stats-title" className="font-bold">{t("staffReviewStats")}</h2>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {cards.map(([key, value]) => <div key={key}><p className="text-sm text-slate-600">{t(key)}</p><p className="mt-1 text-2xl font-bold">{value ?? "—"}</p></div>)}
    </div>
  </section>;
}

function EditProfileDialog({ profile, onClose, onSaved }) {
  const { t } = useLanguage();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [phone, setPhone] = useState(profile?.phoneNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function save(event) {
    event.preventDefault();
    const displayName = name.trim();
    const phoneNumber = phone.trim();
    if (displayName.length < 1 || displayName.length > 80 || (phoneNumber && !/^\+?[0-9]{8,15}$/.test(phoneNumber))) {
      setError("staffProfileInvalid");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ displayName, phoneNumber: phoneNumber || null });
      onSaved();
    } catch (saveError) {
      setError(saveError?.status === 400 ? "staffProfileInvalid" : "staffProfileSaveError");
      setBusy(false);
    }
  }
  return <StaffDialog title={t("staffEditProfile")} busy={busy} onClose={onClose}>
    <form onSubmit={save} className="space-y-4 p-6">
      <label className="block text-sm font-semibold">{t("staffName")}
        <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} autoComplete="name" />
      </label>
      <label className="block text-sm font-semibold">{t("staffPhone")}
        <input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} autoComplete="tel" inputMode="tel" />
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{t(error)}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:opacity-50">{t("staffSave")}</button>
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50">{t("staffCancel")}</button>
      </div>
    </form>
  </StaffDialog>;
}

export default function ConsoleProfilePage() {
  const { profile, logout, handleUnauthorized, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  async function completed() {
    try { await logout(); } catch { handleUnauthorized(); }
    navigate("/console", { replace: true, state: { passwordChanged: true } });
  }
  async function profileSaved() {
    try { await refreshProfile(); } catch { /* keep the old profile on screen; fresh values load on next focus */ }
    setEditOpen(false);
  }
  return <section className="mx-auto max-w-4xl space-y-6"><h1 className="text-2xl font-bold">{t("staffProfile")}</h1>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6"><dl className="space-y-4">{[["staffName", profile?.displayName], ["staffEmail", profile?.email], ["staffPhone", profile?.phoneNumber], ["staffDateOfBirth", profile?.dateOfBirth]].map(([key, value]) => <div key={key}><dt className="text-sm text-slate-600">{t(key)}</dt><dd className="mt-1 break-words font-semibold">{value || "—"}</dd></div>)}</dl>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditOpen(true)} className="min-h-11 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600">{t("staffEditProfile")}</button>
          <button type="button" onClick={() => setPasswordOpen(true)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50 focus-visible:outline-blue-600">{t("staffChangePassword")}</button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6"><CompletionRing profile={profile} t={t} /></div>
    </div>
    <ReviewStats t={t} />
    {editOpen && <EditProfileDialog profile={profile} onClose={() => setEditOpen(false)} onSaved={profileSaved} />}
    {passwordOpen && <StaffDialog title={t("staffChangePassword")} busy={passwordBusy} onClose={() => setPasswordOpen(false)}><div className="p-6"><StaffPasswordForm onSuccess={completed} onBusyChange={setPasswordBusy} /><button type="button" disabled={passwordBusy} onClick={() => setPasswordOpen(false)} className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">{t("staffCancel")}</button></div></StaffDialog>}
  </section>;
}
