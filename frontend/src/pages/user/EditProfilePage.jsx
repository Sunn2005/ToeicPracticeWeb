import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateUserProfile } from "../../api/userLearning";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import ProAvatarBadge from "../../components/user/ProAvatarBadge";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const AVATAR_SIZE = 256;

function getInitials(displayName) {
  const words = (displayName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

// Downscale the chosen photo to a small square so the data URL stays well
// under Firestore's 1MB document limit and can be saved via PATCH /api/me.
function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      canvas
        .getContext("2d")
        .drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE,
        );
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("unreadable"));
    };
    image.src = objectUrl;
  });
}

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-50";

function EditProfileForm({ profile, t }) {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || "");
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [phone, setPhone] = useState(profile.phoneNumber || "");
  const [dob, setDob] = useState(profile.dateOfBirth || "");
  const [gender, setGender] = useState(profile.gender || "");
  const [targetScore, setTargetScore] = useState(String(profile.targetScore ?? ""));
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const previewUrl = photoRemoved ? "" : photoUrl;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoError(t("profilePhotoTypeError"));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(t("profilePhotoSizeError"));
      return;
    }
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setPhotoUrl(dataUrl);
      setPhotoRemoved(false);
    } catch {
      setPhotoError(t("profilePhotoReadError"));
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        photoUrl: photoRemoved ? null : photoUrl.trim() || null,
        targetScore: targetScore === "" ? null : Number(targetScore),
        phoneNumber: phone.trim() || null,
        dateOfBirth: dob || null,
        gender: gender || null,
      });
      await refreshProfile();
      navigate("/profile");
    } catch (requestError) {
      const errorKey = requestError.status === 401
        ? "profileSessionExpired"
        : requestError.status === 403
          ? "profileSaveForbidden"
          : requestError.status === 400
            ? "profileInvalidFields"
            : "profileSaveFailed";
      setError(t(errorKey));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={save}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h2 className="text-lg font-bold text-slate-950">{t("personalInformation")}</h2>
      <p className="mt-1 text-sm text-slate-500">{t("profileEditDesc")}</p>

      <fieldset disabled={saving} className="min-w-0">
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="relative inline-flex w-fit shrink-0">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={displayName}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-xl font-bold text-sky-600">
                {getInitials(displayName || profile.displayName)}
              </span>
            )}
            <ProAvatarBadge subscription={profile.subscription} />
          </span>
          <div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
              >
                {t("profileChangePhoto")}
              </button>
              {(previewUrl || profile.photoUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl("");
                    setPhotoRemoved(true);
                    setPhotoError("");
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {t("profileRemovePhoto")}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">{t("profilePhotoHint")}</p>
            {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="my-6 h-px bg-slate-100" />

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("fullName")} <span className="text-red-500">*</span>
            </span>
            <input
              required
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Email <span className="text-red-500">*</span>
            </span>
            <input value={profile.email || ""} disabled className={`${inputClass} bg-slate-50 text-slate-500`} />
            <span className="mt-1 block text-xs text-slate-400">{t("loginEmailLocked")}</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">{t("profilePhone")}</span>
            <input
              type="tel"
              pattern="[+]?[0-9]{8,15}"
              title={t("profilePhoneHint")}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0987654321"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">{t("profileDob")}</span>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={dob}
              onChange={(event) => setDob(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">{t("profileGender")}</span>
            <select value={gender} onChange={(event) => setGender(event.target.value)} className={inputClass}>
              <option value="">—</option>
              <option value="MALE">{t("profileGenderMale")}</option>
              <option value="FEMALE">{t("profileGenderFemale")}</option>
              <option value="OTHER">{t("profileGenderOther")}</option>
              <option value="PREFER_NOT_TO_SAY">{t("profileGenderPrivate")}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("toeicTarget")}
            </span>
            <input
              type="number"
              min={10}
              max={990}
              step={5}
              value={targetScore}
              onChange={(event) => setTargetScore(event.target.value)}
              className={`${inputClass} bg-white`}
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-7 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate("/profile")}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:bg-sky-300"
        >
          {saving ? t("saving") : t("saveChanges")}
        </button>
      </div>
    </form>
  );
}

export default function EditProfilePage() {
  const { t } = useLanguage();
  const { profile, profileLoading, profileError } = useAuth();

  if (profileLoading && !profile) {
    return (
      <div className="mx-auto max-w-[1380px]">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {t("loadingProfile")}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-[1380px]">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          {profileError || t("profileLoadFailed")}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1380px]">
      <div className="mb-5 text-sm text-slate-500">
        {t("profileNav")} <span className="mx-2">/</span>{" "}
        <strong className="text-sky-600">{t("profileEditBreadcrumb")}</strong>
      </div>
      <EditProfileForm key={profile.uid} profile={profile} t={t} />
    </div>
  );
}
