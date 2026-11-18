import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../../../../components/ui/usePageTitle";
import { getAdminLearners } from "../../../../api/admin/adminLearners";
import { useLanguage } from "../../../../i18n/LanguageContext";
import { formatLearnerDate, learnerErrorKey, learnerInitials } from "../../utils/adminLearners";

const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
const buttonClass = "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

function Status({ learner, t }) {
  const label = learner.proStatus === "PRO" ? t("adminLearnersPro")
    : learner.proStatus === "FREE" ? t("adminLearnersFree") : t("adminLearnersUnknown");
  const color = learner.proStatus === "PRO" ? "bg-emerald-100 text-emerald-700"
    : learner.proStatus === "FREE" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

export default function LearnersListPage() {
  const { t, language } = useLanguage();
  usePageTitle(t("adminLearnersTitle"));
  const [filters, setFilters] = useState({ search: "", pro: "ALL" });
  const [applied, setApplied] = useState(filters);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const items = pages.flatMap((page) => page.items || []);
  const cursor = pages.at(-1)?.nextCursor;
  const load = async (nextCursor, reset = false) => {
    setLoading(true); setError("");
    try {
      const page = await getAdminLearners({ ...applied, cursor: nextCursor });
      setPages((current) => reset ? [page] : [...current, page]);
    } catch (loadError) {
      setError(learnerErrorKey(loadError));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    getAdminLearners(applied, { signal: controller.signal }).then(
      (page) => { if (!controller.signal.aborted) { setPages([page]); setError(""); } },
      (loadError) => { if (!controller.signal.aborted) setError(learnerErrorKey(loadError)); },
    );
    return () => controller.abort();
  }, [applied]);

  function submit(event) {
    event.preventDefault();
    setLoading(true);
    setApplied({ search: filters.search.trim(), pro: filters.pro });
  }

  return <section className="mx-auto max-w-[1500px] space-y-6">
    <header><h1 className="text-2xl font-bold text-slate-950">{t("adminLearnersTitle")}</h1><p className="mt-1 text-sm text-slate-600">{t("adminLearnersDescription")}</p></header>
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-sm font-semibold">{t("adminLearnersSearch")}
        <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} className={inputClass} placeholder={t("adminLearnersSearchPlaceholder")} autoComplete="off" />
      </label>
      <label className="text-sm font-semibold">{t("adminLearnersPlan")}
        <select value={filters.pro} onChange={(event) => setFilters({ ...filters, pro: event.target.value })} className={inputClass}>
          <option value="ALL">{t("adminLearnersAllPlans")}</option><option value="PRO">{t("adminLearnersPro")}</option><option value="FREE">{t("adminLearnersFree")}</option>
        </select>
      </label>
      <button type="submit" className="min-h-11 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{t("adminLearnersSearchAction")}</button>
    </form>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-800"><p>{t(error)}</p><button type="button" className={`${buttonClass} mt-3`} onClick={() => load(cursor, pages.length === 0)}>{t("adminLearnersRetry")}</button></div>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">{t("adminLearnersTitle")}</caption>
        <thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3">{t("adminLearnersLearner")}</th><th className="px-5 py-3">{t("adminLearnersJoined")}</th><th className="px-5 py-3">{t("adminLearnersLastLogin")}</th><th className="px-5 py-3">{t("adminLearnersTarget")}</th><th className="px-5 py-3">{t("adminLearnersPlan")}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{items.map((learner) => <tr key={learner.uid} className="hover:bg-slate-50"><td className="px-5 py-3"><Link to={`/console/learners/${encodeURIComponent(learner.uid)}`} className="flex items-center gap-3 font-semibold text-blue-700 hover:underline">{learner.photoUrl ? <img src={learner.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" /> : <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs text-blue-700">{learnerInitials(learner)}</span>}<span className="min-w-0"><span className="block truncate">{learner.displayName || t("adminLearnersUnnamed")}</span><span className="block truncate text-xs font-normal text-slate-500">{learner.email || "—"}</span></span></Link></td><td className="whitespace-nowrap px-5 py-3">{formatLearnerDate(learner.createdAt, language)}</td><td className="whitespace-nowrap px-5 py-3">{formatLearnerDate(learner.lastLoginAt, language)}</td><td className="px-5 py-3 text-center">{learner.targetScore ?? "—"}</td><td className="px-5 py-3"><Status learner={learner} t={t} /></td></tr>)}</tbody>
      </table></div>
      {!loading && !items.length && !error && <p role="status" className="p-12 text-center text-sm text-slate-500">{t("adminLearnersEmpty")}</p>}
      {loading && <p role="status" className="p-5 text-sm text-slate-600">{t("adminLearnersLoading")}</p>}
      {cursor && !loading && <div className="border-t border-slate-200 p-4"><button type="button" className={buttonClass} onClick={() => load(cursor)}>{t("adminLearnersLoadMore")}</button></div>}
    </div>
  </section>;
}
