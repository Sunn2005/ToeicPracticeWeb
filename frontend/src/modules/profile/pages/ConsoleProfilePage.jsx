import usePageTitle from "../../../components/ui/usePageTitle";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { canUseConsole } from "../../../auth/consolePermissions";
import { useLanguage } from "../../../i18n/LanguageContext";
import { updateProfile } from "../../../api/me.js";
import { getStaffDirectory } from "../../../api/staff/adminStaff.js";
import { getPendingSubmissions, getReviewHistory } from "../../../api/tests/adminReviews.js";
import StaffDialog from "../../staff-management/components/StaffDialog";
import StaffPasswordForm from "../../authentication/components/StaffPasswordForm";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
const consoleFeatures = ["dashboard", "staff", "tests", "reviews", "history", "orders", "revenue"];
const defaultGroupLabels = new Map([
  ["admin", "staffProfileGroupAdmin"],
  ["creators", "staffProfileGroupCreators"],
  ["reviewers", "staffProfileGroupReviewers"],
  ["business", "staffProfileGroupBusiness"],
]);

function profileInitials(profile) {
  const name = (profile?.displayName || "").trim();
  if (name) return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
  const local = (profile?.email || "").split("@")[0];
  return (local.slice(0, 2) || "?").toUpperCase();
}

function ReviewStats({ t, canViewHistory, canViewQueue, canViewStaff, staffCount }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      canViewHistory ? getReviewHistory() : null,
      canViewQueue ? getPendingSubmissions() : null,
    ]).then(([history, queue]) => {
      if (cancelled) return;
      const historyList = history.value;
      const queueList = queue.value;
      setStats({
        approved: Array.isArray(historyList) ? historyList.filter((item) => item.status === "APPROVED").length : null,
        rejected: Array.isArray(historyList) ? historyList.filter((item) => item.status === "REJECTED").length : null,
        pending: Array.isArray(queueList) ? queueList.length : null,
      });
    });
    return () => { cancelled = true; };
  }, [canViewHistory, canViewQueue]);
  const cards = [
    { visible: canViewHistory, key: "staffStatsApproved", value: stats?.approved, icon: <path d="M20 6 9 17l-5-5" />, iconClass: "bg-green-50 text-green-700" },
    { visible: canViewHistory, key: "staffStatsRejected", value: stats?.rejected, icon: <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>, iconClass: "bg-red-50 text-red-600" },
    { visible: canViewQueue, key: "staffStatsPending", value: stats?.pending, icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, iconClass: "bg-amber-50 text-amber-600" },
    { visible: canViewStaff, key: "staffStatsStaff", value: staffCount, icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>, iconClass: "bg-blue-50 text-blue-600" },
  ].filter((card) => card.visible);
  return <section aria-labelledby="profile-stats-title" className="rounded-2xl border border-slate-200 bg-white p-6">
    <h2 id="profile-stats-title" className="font-bold">{t("staffReviewStats")}</h2>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, value, icon, iconClass }) => <div key={key} className="flex items-start gap-3">
        <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconClass}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
        <div className="min-w-0"><p className="text-sm text-slate-600">{t(key)}</p><p className="mt-1 text-2xl font-bold">{value ?? "—"}</p></div>
      </div>)}
    </div>
  </section>;
}

function EditProfileDialog({ profile, onClose, onSaved }) {
  const { t } = useLanguage();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function save(event) {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName.length < 1 || displayName.length > 80) {
      setError("staffProfileInvalid");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        displayName,
        photoUrl: profile?.photoUrl,
        targetScore: profile?.targetScore,
        phoneNumber: profile?.phoneNumber,
        dateOfBirth: profile?.dateOfBirth,
        gender: profile?.gender,
      });
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
  usePageTitle(t("staffProfile"));
  const navigate = useNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [staffDirectory, setStaffDirectory] = useState(null);
  const uid = profile?.uid;
  const canViewStaff = canUseConsole(profile, "staff.view");
  const canViewHistory = canUseConsole(profile, "history.view");
  const canViewQueue = canUseConsole(profile, "reviews.view");
  useEffect(() => {
    if (!canViewStaff) return;
    const controller = new AbortController();
    getStaffDirectory({ signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setStaffDirectory({ uid, data });
      },
      () => {
        if (!controller.signal.aborted) setStaffDirectory(null);
      },
    );
    return () => controller.abort();
  }, [canViewStaff, uid]);
  async function completed() {
    try { await logout(); } catch { handleUnauthorized(); }
    navigate("/console", { replace: true, state: { passwordChanged: true } });
  }
  async function profileSaved() {
    try { await refreshProfile(); } catch { /* keep the old profile on screen; fresh values load on next focus */ }
    setEditOpen(false);
  }
  const isAdmin = profile?.role === "ADMIN";
  const groupId = profile?.consoleAccess?.groupId;
  const directory = canViewStaff && staffDirectory?.uid === uid ? staffDirectory?.data : null;
  const configuredGroupName = directory?.groups?.find((group) => group.id === groupId)?.name;
  const defaultGroupLabel = defaultGroupLabels.get(groupId);
  const groupName = configuredGroupName || (defaultGroupLabel ? t(defaultGroupLabel) : groupId || "—");
  const staffCount = Array.isArray(directory?.members) ? directory.members.length : null;
  const granted = new Set((profile?.consoleAccess?.permissions ?? []).map((permission) => String(permission).split(".")[0]));
  const permissions = profile?.consoleAccess?.permissions ?? [];
  const chips = [];
  for (const feature of consoleFeatures) {
    if (!granted.has(feature)) continue;
    chips.push({ key: feature, label: t(`staffFeature_${feature}`) });
    if (feature === "tests" && permissions.includes("tests.add")) chips.push({ key: "createTest", label: t("staffPermissionCreateTest") });
  }
  if (permissions.includes("account.view")) chips.push({ key: "account", label: t("staffPermissionProfile") });
  return <section className="mx-auto max-w-[1500px] space-y-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start gap-5">
        <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">{profileInitials(profile)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-bold">{profile?.displayName || "—"}</h2>
          <p className="mt-1 break-words text-sm text-slate-600">{profile?.email || "—"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{isAdmin ? "Quản trị viên" : profile?.role === "EMPLOYEE" ? "Nhân viên" : "—"}</span>
            <span className="min-w-0 break-words rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{t("staffProfileGroup").replace("{group}", () => groupName)}</span>
            {profile?.consoleAccess?.active !== false && <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-500" />{t("staffProfileActive")}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditOpen(true)} className="min-h-11 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-blue-600">{t("staffEditProfile")}</button>
          <button type="button" onClick={() => setPasswordOpen(true)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-50 focus-visible:outline-blue-600">{t("staffChangePassword")}</button>
        </div>
      </div>
    </div>
    {(canViewHistory || canViewQueue || canViewStaff) && (
      <ReviewStats
        key={`${uid}:${canViewHistory}:${canViewQueue}`}
        t={t}
        canViewHistory={canViewHistory}
        canViewQueue={canViewQueue}
        canViewStaff={canViewStaff}
        staffCount={staffCount}
      />
    )}
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="font-bold">{t("staffPermissionsTitle")}</h2>
      <div className="mt-4 flex flex-wrap gap-2">{chips.length ? chips.map(({ key, label }) => <span key={key} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{label}</span>) : <span className="text-sm text-slate-600">—</span>}</div>
    </div>
    {editOpen && <EditProfileDialog profile={profile} onClose={() => setEditOpen(false)} onSaved={profileSaved} />}
    {passwordOpen && <StaffDialog title={t("staffChangePassword")} busy={passwordBusy} onClose={() => setPasswordOpen(false)}><div className="p-6"><StaffPasswordForm onSuccess={completed} onBusyChange={setPasswordBusy} /><button type="button" disabled={passwordBusy} onClick={() => setPasswordOpen(false)} className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-semibold disabled:opacity-50">{t("staffCancel")}</button></div></StaffDialog>}
  </section>;
}
