import { useState } from "react";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";

function ProfileForm({ profile, onSaved, t }) {
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || "");
  const [targetScore, setTargetScore] = useState(String(profile.targetScore || 750));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ displayName, photoUrl: photoUrl || null, targetScore: Number(targetScore) }),
      });
      await onSaved();
      setMessage(t("changesSaved"));
    } catch (requestError) {
      setError(requestError.message || t("profileSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDisplayName(profile.displayName || "");
    setPhotoUrl(profile.photoUrl || "");
    setTargetScore(String(profile.targetScore || 750));
    setMessage("");
    setError("");
  };

  return (
    <form onSubmit={save} className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-bold">{t("personalInformation")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("profileDescription")}</p>

      <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center">
        {photoUrl ? <img src={photoUrl} alt={t("avatarUrl")} className="h-20 w-20 rounded-full border border-slate-200 object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-50 text-2xl font-bold text-sky-500">{(displayName || "U").charAt(0).toUpperCase()}</span>}
        <label className="min-w-0 flex-1">
          <span className="text-sm font-semibold">{t("avatarUrl")}</span>
          <input value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://..." className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50" />
          <span className="mt-2 block text-xs text-slate-400">{t("avatarFallbackHint")}</span>
        </label>
      </div>

      <div className="my-7 h-px bg-slate-100" />
      <div className="grid gap-5 sm:grid-cols-2">
        <label><span className="text-sm font-semibold">{t("fullName")} <span className="text-red-500">*</span></span><input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50" /></label>
        <label><span className="text-sm font-semibold">Email</span><input value={profile.email || ""} disabled className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500" /><span className="mt-1 block text-xs text-slate-400">{t("loginEmailLocked")}</span></label>
        <label><span className="text-sm font-semibold">{t("toeicTarget")} <span className="text-red-500">*</span></span><select value={targetScore} onChange={(event) => setTargetScore(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-sky-400">{Array.from({ length: 19 }, (_, index) => 500 + index * 25).filter((score) => score <= 950).map((score) => <option key={score} value={score}>{score}</option>)}<option value="990">990</option></select></label>
        <div className="rounded-lg bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-700"><strong>{t("learningGoalTitle")}</strong><p>{t("learningGoalNote")}</p></div>
      </div>

      {error && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
      <div className="mt-7 flex justify-end gap-3">
        <button type="button" onClick={reset} disabled={saving} className="rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-50">{t("cancel")}</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600 disabled:bg-sky-300">{saving ? t("saving") : t("saveChanges")}</button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { t } = useLanguage();
  const { profile, profileLoading, profileError, refreshProfile } = useAuth();
  if (profileLoading && !profile) return <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{t("loadingProfile")}</div>;
  if (!profile) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{profileError || t("profileLoadFailed")}</div>;
  return (
    <div className="mx-auto max-w-[1380px]">
      <div className="mb-5 text-sm text-slate-500">{t("profileNav")} <span className="mx-2">/</span> <strong className="text-sky-600">{t("editProfile")}</strong></div>
      <ProfileForm key={`${profile.uid}-${profile.displayName}-${profile.targetScore}`} profile={profile} onSaved={refreshProfile} t={t} />
    </div>
  );
}
