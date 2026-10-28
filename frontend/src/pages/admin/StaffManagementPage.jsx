import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useLanguage } from "../../i18n/LanguageContext";
import { togglePermission } from "../../auth/consolePermissions";
import { deleteStaffGroup, deleteStaffMember, getStaffDirectory, resendStaffCredentials, saveStaffGroup, saveStaffMember, staffErrorKey } from "../../api/adminStaff";
import StaffDialog from "../../components/admin/StaffDialog";

const panel = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const buttonBase = "min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40";
const button = `${buttonBase} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`;
const primary = `${buttonBase} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`;
const input = "mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
const actions = ["blocked", "view", "add", "edit", "delete", "all"];

function GroupForm({ group, busy, onSave, onCancel, t }) {
  const [draft, setDraft] = useState(group || { name: "", code: "", description: "", permissions: ["dashboard.view"] });
  return <form className="mt-5 space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
    <h3 className="font-semibold">{t(group ? "staffEditGroup" : "staffNewGroup")}</h3>
    {[['name', 'staffGroupName', 80], ['code', 'staffGroupCode', 40], ['description', 'staffGroupDescription', 500]].map(([key, label, max]) => <label key={key} className="block text-sm font-medium">{t(label)}{key !== "description" && " *"}<input required={key !== "description"} disabled={busy || (group?.id === "admin" && key === "code")} maxLength={max} pattern={key === "code" ? "[A-Za-z][A-Za-z0-9_]{1,39}" : undefined} value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className={input} /></label>)}
    <div className="flex gap-2"><button type="submit" disabled={busy} className={`${primary} flex-1`}>{t("staffSaveGroup")}</button><button type="button" disabled={busy} className={button} onClick={onCancel}>{t("staffCancel")}</button></div>
  </form>;
}

function PermissionEditor({ group, catalog, busy, onSave, onDirty, t }) {
  const [permissions, setPermissions] = useState(group.permissions || []);
  const protectedGroup = group.id === "admin";
  const dirty = JSON.stringify([...permissions].sort()) !== JSON.stringify([...(group.permissions || [])].sort());
  return <div className="space-y-4">
    <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-slate-600"><h3 className="font-semibold text-slate-900">{t("staffRulesTitle")}</h3><p>{t("staffRules")}</p></div>
    {protectedGroup && <p className="text-sm text-slate-500">{t("staffAdminProtected")}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label={t("staffPermissions")}>
      <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="min-w-52 px-4 py-3">{t("staffFeature")}</th>{actions.map((action) => <th scope="col" key={action} className="px-2 py-3 text-center">{t(`staffAction_${action}`)}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{catalog.map((feature) => <tr key={feature.id}><th scope="row" className="px-4 py-3 font-medium">{t(`staffFeature_${feature.id}`)}</th>{actions.map((action) => {
          const applicable = ["blocked", "all"].includes(action) || feature.actions.includes(action);
          const checked = action === "blocked" ? !permissions.includes(`${feature.id}.view`) : action === "all" ? feature.actions.length > 1 && feature.actions.every((item) => permissions.includes(`${feature.id}.${item}`)) : permissions.includes(`${feature.id}.${action}`);
          return <td key={action} className="text-center">{applicable ? <label className="inline-grid min-h-11 min-w-11 cursor-pointer place-items-center"><input type="checkbox" checked={checked} disabled={busy || protectedGroup || feature.id === "staff" || (action === "all" && feature.actions.length === 1)} aria-label={`${t(`staffFeature_${feature.id}`)}: ${t(`staffAction_${action}`)}`} className="h-5 w-5 accent-blue-600 disabled:cursor-not-allowed" onChange={(event) => {
            const next = togglePermission(permissions, feature, action, event.target.checked); setPermissions(next); onDirty(JSON.stringify([...next].sort()) !== JSON.stringify([...group.permissions].sort()));
          }} /></label> : <span className="text-slate-400">—</span>}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-between gap-4"><div><h3 className="font-semibold">{t("staffPermissions")} — {group.name}</h3><p className="mt-1 text-sm text-slate-500">{t("staffApplies")}</p></div><button type="button" className={primary} disabled={busy || !dirty || protectedGroup} onClick={() => onSave({ ...group, permissions })}>{t("staffSave")}</button></div>
  </div>;
}

function MemberForm({ member, groups, defaultGroup, selfUid, busy, error, onSave, onClose, t }) {
  const create = !member;
  const [draft, setDraft] = useState({ displayName: "", phoneNumber: "", email: "", groupId: member?.groupId || defaultGroup || groups.find((group) => group.id !== "admin")?.id || "admin", active: member?.active ?? true, notes: member?.notes || "" });
  const lockedSelf = member?.uid === selfUid;
  return <StaffDialog title={t(create ? "staffAddMember" : "staffEditMember")} onClose={onClose} busy={busy}>
    <form className="space-y-4 p-6" onSubmit={(event) => { event.preventDefault(); if (!busy) onSave({ ...draft, ...(member ? { uid: member.uid, version: member.version } : {}) }, create); }}>
      {create ? <>
        <p className="text-sm leading-6 text-slate-600">{t("staffCreateHint")}</p>
        {[["displayName", "staffName", "text", 80], ["phoneNumber", "staffPhone", "tel", 16], ["email", "staffEmail", "email", 254]].map(([key, label, type, maxLength]) => <label key={key} className="block text-sm font-semibold">{t(label)} *<input autoFocus={key === "displayName"} required type={type} maxLength={maxLength} pattern={key === "phoneNumber" ? "[+]?[0-9]{8,15}" : key === "displayName" ? ".*\\S.*" : undefined} autoComplete={key === "displayName" ? "name" : key === "phoneNumber" ? "tel" : "email"} value={draft[key]} disabled={busy} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className={input} /></label>)}
        <p className="text-xs leading-5 text-slate-500">{t("staffPhoneHint")}</p>
      </> : <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">{member.displayName || "—"}</p><p className="break-all text-sm text-slate-600">{member.email}</p><p className="text-sm text-slate-600">{member.phoneNumber || "—"}</p></div>}
      <label className="block text-sm font-semibold">{t("staffGroup")} *<select required value={draft.groupId} disabled={busy || lockedSelf} className={input} onChange={(event) => setDraft({ ...draft, groupId: event.target.value })}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label className="block text-sm font-semibold">{t("staffNotes")}<textarea maxLength={1000} rows={3} disabled={busy} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className={input} /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={draft.active} disabled={busy || lockedSelf} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} className="h-5 w-5 accent-blue-600" />{t("staffActive")}</label>
      {lockedSelf && <p className="text-xs text-slate-500">{t("staffSelfProtected")}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">{t("staffRequired")}</p><div className="flex gap-2"><button type="button" disabled={busy} className={button} onClick={onClose}>{t("staffCancel")}</button><button type="submit" disabled={busy || !draft.groupId} className={primary}>{t(busy ? "staffWorking" : create ? "staffAddMember" : "staffSave")}</button></div></div>
    </form>
  </StaffDialog>;
}

export default function StaffManagementPage() {
  const { t } = useLanguage();
  const { profile, refreshProfile } = useAuth();
  const [data, setData] = useState({ groups: [], members: [], catalog: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [groupId, setGroupId] = useState("");
  const [selectedUid, setSelectedUid] = useState("");
  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [groupForm, setGroupForm] = useState(null);
  const [memberForm, setMemberForm] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [dirty, setDirty] = useState(false);
  const request = useRef({ id: 0, busy: false });
  const load = useCallback(async () => {
    const id = ++request.current.id; setLoading(true);
    try { const result = await getStaffDirectory(); if (id === request.current.id) { setData(result); setSelectedUid(""); } }
    catch (failure) { if (id === request.current.id) setError(staffErrorKey(failure)); }
    finally { if (id === request.current.id) setLoading(false); }
  }, []);
  useEffect(() => {
    // Initial and explicit refresh share the same guarded async loader.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const state = request.current;
    return () => { state.id += 1; };
  }, [load]);
  async function mutate(operation, done) {
    if (request.current.busy) return;
    request.current.busy = true; setBusy(true); setError(""); setSuccess("");
    try { const result = await operation(); done?.(result); setDirty(false); await load(); setSuccess(result?.emailStatus === "FAILED" ? "staffCreatedMailFailed" : result?.emailStatus === "SENT" ? "staffMailSent" : "staffSaved"); await refreshProfile().catch(() => {}); }
    catch (failure) { setError(staffErrorKey(failure)); }
    finally { request.current.busy = false; setBusy(false); }
  }
  const group = data.groups.find((item) => item.id === groupId);
  const selected = data.members.find((member) => member.uid === selectedUid);
  const resendWait = Math.max(0, Math.ceil(((selected?.lastSentAt || 0) + 60000 - now) / 1000));
  const filtered = data.members.filter((member) => (!groupId || member.groupId === groupId) && (!status || (status === "active") === member.active) && `${member.displayName || ""} ${member.email || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 5));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * 5, currentPage * 5);
  const blocked = busy || loading;
  function discard() { return !dirty || window.confirm(t("staffUnsaved")); }
  function chooseGroup(id) { if (!discard()) return; setGroupId(id); setDirty(false); setPage(1); setSelectedUid(""); setGroupForm(null); }
  function closeMember() { setMemberForm(null); setError(""); }
  return <section className="mx-auto max-w-[1600px] space-y-7" aria-busy={blocked}>
    <div><h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{t("staffTitle")}</h1><p className="mt-2 text-sm text-slate-500 sm:text-base">{t("staffDescription")}</p></div>
    {error && !memberForm && !confirmation && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t(error)}</div>}
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm text-slate-600">{blocked ? t(busy ? "staffWorking" : "staffLoading") : success ? t(success) : ""}</div>
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
      <aside className={`${panel} p-5`}><h2 className="text-sm font-bold uppercase text-slate-500">{t("staffGroups")}</h2>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} disabled={blocked} onClick={() => { if (discard()) { setGroupForm({ create: true }); setTab("members"); setDirty(false); } }}>{t("staffAdd")}</button><button type="button" className={button} disabled={blocked || !group} onClick={() => { if (discard()) { setGroupForm({ group }); setTab("members"); setDirty(false); } }}>{t("staffEdit")}</button><button type="button" className={button} disabled={blocked || !group || group.id === "admin"} onClick={() => { setError(""); setConfirmation({ type: "group", item: group }); }}>{t("staffDelete")}</button></div>
        <div className="mt-4 space-y-2"><button type="button" disabled={blocked} onClick={() => chooseGroup("")} aria-pressed={!groupId} className={`w-full rounded-xl p-3 text-left font-semibold ${!groupId ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50"}`}>{t("staffAllGroups")}<span className="mt-1 block text-sm font-normal">{data.members.length} {t("staffCount")}</span></button>{data.groups.map((item) => <button type="button" key={item.id} disabled={blocked} aria-pressed={item.id === groupId} onClick={() => chooseGroup(item.id)} className={`w-full rounded-xl p-3 text-left font-semibold ${item.id === groupId ? "bg-blue-50 text-blue-600" : "text-slate-700 hover:bg-slate-50"}`}>{item.name}<span className="mt-1 block text-sm font-normal text-slate-500">{data.members.filter((member) => member.groupId === item.id).length} {t("staffCount")}</span></button>)}</div>
        {groupForm ? <GroupForm key={groupForm.group?.id || "new"} group={groupForm.group} busy={blocked} t={t} onCancel={() => setGroupForm(null)} onSave={(draft) => mutate(() => saveStaffGroup(draft), (result) => { setGroupId(result.id); setGroupForm(null); })} /> : <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{t(group?.id === "admin" ? "staffAdminProtected" : "staffGroupHint")}</p>}
      </aside>
      <div className={`${panel} min-w-0 p-4 sm:p-6`}>
        <div role="tablist" aria-label={t("staffTitle")} className="mb-6 flex gap-6 border-b border-slate-200">{["members", "permissions"].map((item) => <button key={item} id={`staff-tab-${item}`} type="button" role="tab" aria-selected={tab === item} aria-controls="staff-tab-content" disabled={blocked} onClick={() => { if (item !== tab && discard()) { setTab(item); setDirty(false); } }} className={`min-h-12 border-b-2 px-1 pb-3 font-semibold ${tab === item ? "border-blue-500 text-blue-600" : "border-transparent text-slate-500"}`}>{t(item === "members" ? "staffMembers" : "staffPermissions")}</button>)}</div>
        <div id="staff-tab-content" role="tabpanel" aria-labelledby={`staff-tab-${tab}`}>
          {tab === "permissions" ? group ? <PermissionEditor key={`${group.id}:${group.version}`} group={group} catalog={data.catalog} busy={blocked} t={t} onDirty={setDirty} onSave={(draft) => mutate(() => saveStaffGroup(draft))} /> : <p className="py-12 text-center text-sm text-slate-500">{t("staffChooseGroup")}</p> : <>
            <div className="flex flex-wrap justify-between gap-3"><div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={blocked} onClick={() => { setError(""); setMemberForm({ create: true }); }}>+ {t("staffAddMember")}</button><button type="button" className={button} disabled={blocked || !selected} onClick={() => { setError(""); setMemberForm({ member: selected }); }}>{t("staffEdit")}</button><button type="button" className={button} disabled={blocked || !selected || selected.uid === profile.uid} onClick={() => { setError(""); setConfirmation({ type: "member", item: selected }); }}>{t("staffDelete")}</button></div><button type="button" className={button} disabled={blocked} onClick={() => { if (discard()) { setError(""); setSuccess(""); load(); } }}>{t("staffRefresh")}</button></div>
            {selected?.provisioned && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="min-w-0 flex-1 break-words text-sm text-slate-600">{selected.email} · {t(`staffMail_${selected.emailStatus || "PENDING"}`)}</p>
              <button type="button" className={button} disabled={blocked || resendWait > 0 || !selected.active || selected.emailStatus === "PENDING"} onClick={() => { setError(""); setConfirmation({ type: "resend", item: selected }); }}>{t("staffResend")}{resendWait > 0 ? ` (${resendWait}s)` : ""}</button>
            </div>}
            <div className="mt-5 flex flex-wrap items-center gap-3"><input type="search" aria-label={t("staffSearch")} placeholder={t("staffSearch")} value={search} className={`${input} mt-0 sm:max-w-xs`} onChange={(event) => { setSearch(event.target.value); setPage(1); setSelectedUid(""); }} /><select aria-label={t("staffStatus")} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelectedUid(""); }} className={`${input} mt-0 sm:max-w-48`}><option value="">{t("staffAllStatuses")}</option><option value="active">{t("staffActive")}</option><option value="locked">{t("staffLocked")}</option></select><span className="ml-auto text-sm text-slate-500">{filtered.length} {t("staffCount")}</span></div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label={t("staffMembers")}><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th scope="col" className="w-12 px-3 py-4"><span className="sr-only">{t("staffMembers")}</span></th>{["staffEmail", "staffName", "staffGroup", "staffStatus", "staffMailStatus"].map((key) => <th scope="col" key={key} className="px-4 py-4">{t(key)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((member) => <tr key={member.uid} className={member.uid === selectedUid ? "bg-blue-50/70" : "hover:bg-slate-50"}><td className="px-3"><label className="grid min-h-14 min-w-8 place-items-center"><input type="radio" name="staff-selection" checked={member.uid === selectedUid} onChange={() => setSelectedUid(member.uid)} aria-label={`${t("staffMembers")}: ${member.email}`} className="h-4 w-4 accent-blue-600" /></label></td><td className="px-4 py-5">{member.email}</td><td className="px-4 py-5">{member.displayName || "—"}<span className="mt-1 block text-xs text-slate-500">{member.phoneNumber || "—"}</span></td><td className="px-4 py-5 font-medium">{data.groups.find((item) => item.id === member.groupId)?.name || "—"}</td><td className="px-4 py-5"><span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${member.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{t(member.active ? "staffActive" : "staffLocked")}</span></td><td className="px-4 py-5 text-xs">{member.provisioned ? t(`staffMail_${member.emailStatus || "PENDING"}`) : "—"}{member.passwordChangeRequired && <p className="mt-1 text-slate-500">{t("staffFirstChange")}</p>}</td></tr>)}</tbody></table>{!loading && !rows.length && <p className="p-12 text-center text-sm text-slate-500">{t("staffEmpty")}</p>}</div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><p>{filtered.length ? `${(currentPage - 1) * 5 + 1}–${Math.min(currentPage * 5, filtered.length)} / ${filtered.length}` : "0"} {t("staffCount")}</p><div className="flex items-center gap-3"><button type="button" disabled={currentPage === 1 || blocked} className={button} onClick={() => { setPage(currentPage - 1); setSelectedUid(""); }}>{t("staffPrevious")}</button><span>{t("staffPage")} {currentPage} / {pageCount}</span><button type="button" disabled={currentPage === pageCount || blocked} className={button} onClick={() => { setPage(currentPage + 1); setSelectedUid(""); }}>{t("staffNext")}</button></div></div>
          </>}
        </div>
      </div>
    </div>
    {memberForm && <MemberForm member={memberForm.member} groups={data.groups} defaultGroup={groupId} selfUid={profile.uid} busy={busy} error={error} t={t} onClose={closeMember} onSave={(draft, create) => mutate(() => saveStaffMember(draft, create), () => setMemberForm(null))} />}
    {confirmation && <StaffDialog title={t(confirmation.type === "resend" ? "staffResend" : "staffDeleteTitle")} busy={busy} onClose={() => { setConfirmation(null); setError(""); }}><div className="space-y-4 p-6"><p className="text-sm leading-6 text-slate-600">{t(confirmation.type === "resend" ? "staffResendConfirm" : confirmation.type === "group" ? "staffGroupDeleteConfirm" : "staffMemberDeleteConfirm")}</p><p className="break-all font-semibold">{confirmation.item.name || confirmation.item.email}</p>{error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}<div className="flex justify-end gap-3"><button type="button" disabled={busy} className={button} onClick={() => { setConfirmation(null); setError(""); }}>{t("staffCancel")}</button><button type="button" disabled={busy} className={`${button} border-red-200 text-red-700 hover:bg-red-50`} onClick={() => mutate(() => confirmation.type === "resend" ? resendStaffCredentials(confirmation.item.uid) : confirmation.type === "group" ? deleteStaffGroup(confirmation.item) : deleteStaffMember(confirmation.item), () => { if (confirmation.type === "group") setGroupId(""); setConfirmation(null); })}>{t(confirmation.type === "resend" ? "staffResend" : "staffDelete")}</button></div></div></StaffDialog>}
  </section>;
}
