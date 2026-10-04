import { useEffect, useRef, useState } from "react";
import { getSubscription, revokeSubscription, upsertSubscription } from "../../api/adminSubscriptions.js";
import { useLanguage } from "../../i18n/LanguageContext";
import { defaultExpiry, expiryEpoch, subscriptionErrorKey, subscriptionStatusKey } from "./subscriptionManagement.js";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:bg-slate-100";
const buttonClass = "min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

function SubscriptionManagementPage() {
  const { t, language } = useLanguage();
  const [uid, setUid] = useState("");
  const [loadedUid, setLoadedUid] = useState("");
  const [summary, setSummary] = useState(null);
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [pending, setPending] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [successKey, setSuccessKey] = useState("");
  const requestState = useRef({ id: 0, busy: false });
  const confirmDialog = useRef(null);

  useEffect(() => {
    const state = requestState.current;
    return () => {
      state.id += 1;
      state.busy = false;
    };
  }, []);

  async function runRequest(kind, request, targetUid, success = "") {
    const state = requestState.current;
    if (state.busy) return;
    state.busy = true;
    const id = ++state.id;
    setPending(kind);
    setErrorKey("");
    setSuccessKey("");
    try {
      const result = await request();
      if (state.id !== id) return;
      setLoadedUid(targetUid);
      setSummary(result);
      setSuccessKey(success);
    } catch (error) {
      if (state.id === id) setErrorKey(subscriptionErrorKey(error));
    } finally {
      if (state.id === id) {
        state.busy = false;
        setPending(null);
      }
    }
  }

  function handleLookup(event) {
    event.preventDefault();
    if (requestState.current.busy) return;
    const targetUid = uid.trim();
    setLoadedUid("");
    setSummary(null);
    setSuccessKey("");
    if (!targetUid) {
      setErrorKey("adminSubscriptionUidRequired");
      return;
    }
    runRequest("lookup", () => getSubscription(targetUid), targetUid);
  }

  function handleSave(event) {
    event.preventDefault();
    if (!loadedUid || requestState.current.busy) return;
    const expiresAt = expiryEpoch(expiry);
    if (expiresAt === null) {
      setSuccessKey("");
      setErrorKey("adminSubscriptionExpiryError");
      return;
    }
    runRequest("save", () => upsertSubscription(loadedUid, expiresAt), loadedUid, "adminSubscriptionSaved");
  }

  function handleRevoke() {
    if (!loadedUid || requestState.current.busy) return;
    confirmDialog.current.close();
    runRequest("revoke", () => revokeSubscription(loadedUid), loadedUid, "adminSubscriptionRevokedSuccess");
  }

  const formatDate = (epoch) => epoch == null ? "—" : new Date(epoch).toLocaleString(language === "vi" ? "vi-VN" : "en-US");
  const canRevoke = loadedUid && summary?.status && summary.status !== "REVOKED";

  return (
    <section className="mx-auto max-w-4xl space-y-6" aria-labelledby="subscription-title" aria-busy={Boolean(pending)}>
      <div>
        <h1 id="subscription-title" className="text-2xl font-bold text-slate-950 sm:text-3xl">{t("adminSubscriptionTitle")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("adminSubscriptionDescription")}</p>
      </div>

      <form onSubmit={handleLookup} noValidate className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <label htmlFor="subscription-uid" className="text-sm font-semibold text-slate-900">{t("adminSubscriptionUid")}</label>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input id="subscription-uid" required value={uid} disabled={Boolean(pending)} autoComplete="off" spellCheck={false} aria-invalid={errorKey === "adminSubscriptionUidRequired"} aria-describedby={errorKey === "adminSubscriptionUidRequired" ? "subscription-error" : undefined} onChange={(event) => {
            setUid(event.target.value);
            setLoadedUid("");
            setSummary(null);
            setErrorKey("");
            setSuccessKey("");
          }} className={inputClass} />
          <button type="submit" disabled={Boolean(pending)} className={`${buttonClass} shrink-0 bg-blue-600 text-white hover:bg-blue-700`}>{t("adminSubscriptionLookup")}</button>
        </div>
      </form>

      <div role="status" aria-live="polite" aria-atomic="true" className="text-sm text-slate-700">
        {pending ? t("adminSubscriptionWorking") : successKey ? <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">{t(successKey)}</p> : null}
      </div>
      {errorKey && <p id="subscription-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{t(errorKey)}</p>}

      {!loadedUid && !pending && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">{t("adminSubscriptionLookupHint")}</p>}
      {loadedUid && (
        <div className="grid min-w-0 gap-6 md:grid-cols-2">
          <section aria-labelledby="subscription-summary-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="subscription-summary-title" className="text-lg font-bold">{t("adminSubscriptionSummary")}</h2>
            <p className="mt-2 break-all font-mono text-sm text-slate-600">{loadedUid}</p>
            <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold" role="status">{t(subscriptionStatusKey(summary))}</p>
            {!summary?.status ? <p className="mt-4 text-sm text-slate-600">{t("adminSubscriptionEmpty")}</p> : (
              <dl className="mt-5 space-y-4 text-sm">
                <div><dt className="text-slate-600">{t("adminSubscriptionPlan")}</dt><dd className="mt-1 break-words font-semibold">{summary.planCode || "—"}</dd></div>
                <div><dt className="text-slate-600">{t("adminSubscriptionStarts")}</dt><dd className="mt-1 font-semibold">{formatDate(summary.startsAt)}</dd></div>
                <div><dt className="text-slate-600">{t("adminSubscriptionExpires")}</dt><dd className="mt-1 font-semibold">{formatDate(summary.expiresAt)}</dd></div>
                <div><dt className="text-slate-600">{t("adminSubscriptionEntitlements")}</dt><dd className="mt-1 break-words font-semibold">{summary.entitlements?.length ? summary.entitlements.map((entitlement) => entitlement === "AI_CHAT" ? t("adminSubscriptionAiChat") : entitlement === "AI_ANALYSIS" ? t("adminSubscriptionAiAnalysis") : entitlement).join(", ") : "—"}</dd></div>
              </dl>
            )}
          </section>

          <form onSubmit={handleSave} noValidate className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold">{t("adminSubscriptionEdit")}</h2>
            <label htmlFor="subscription-expiry" className="mt-5 block text-sm font-semibold">{t("adminSubscriptionExpiryLabel")}</label>
            <input id="subscription-expiry" type="datetime-local" step="1" required value={expiry} disabled={Boolean(pending)} onChange={(event) => {
              setExpiry(event.target.value);
              if (errorKey === "adminSubscriptionExpiryError") setErrorKey("");
              setSuccessKey("");
            }} aria-invalid={errorKey === "adminSubscriptionExpiryError"} aria-describedby={`subscription-expiry-help${errorKey === "adminSubscriptionExpiryError" ? " subscription-error" : ""}`} className={inputClass} />
            <p id="subscription-expiry-help" className="mt-3 text-sm text-slate-600">{t("adminSubscriptionExpiryHelp")}</p>
            <div className="mt-6 flex flex-col gap-3">
              <button type="submit" disabled={Boolean(pending)} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>{t("adminSubscriptionSave")}</button>
              <button type="button" disabled={Boolean(pending) || !canRevoke} onClick={() => confirmDialog.current.showModal()} className={`${buttonClass} border border-red-300 text-red-700 hover:bg-red-50`}>{t("adminSubscriptionRevoke")}</button>
            </div>
          </form>
        </div>
      )}

      <dialog ref={confirmDialog} aria-labelledby="subscription-revoke-title" aria-describedby="subscription-revoke-description" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
        <h2 id="subscription-revoke-title" className="text-lg font-bold">{t("adminSubscriptionRevokeTitle")}</h2>
        <p id="subscription-revoke-description" className="mt-3 text-sm text-slate-600">{t("adminSubscriptionRevokeDescription")}</p>
        <p className="mt-3 break-all font-mono text-sm">{loadedUid}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" autoFocus onClick={() => confirmDialog.current.close()} className={`${buttonClass} border border-slate-300 hover:bg-slate-50`}>{t("adminSubscriptionCancel")}</button>
          <button type="button" disabled={Boolean(pending)} onClick={handleRevoke} className={`${buttonClass} bg-red-700 text-white hover:bg-red-800`}>{t("adminSubscriptionConfirmRevoke")}</button>
        </div>
      </dialog>
    </section>
  );
}

export default SubscriptionManagementPage;
