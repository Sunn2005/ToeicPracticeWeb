import { useAuth } from "../../../../auth/useAuth";
import { Fragment, useEffect, useRef, useState } from "react";
import { getAdminOrder, getAdminOrders, reconcileAdminOrder } from "../../../../api/billing/adminPayments.js";
import { useLanguage } from "../../../../i18n/LanguageContext";
import { buildOrdersQuery, formatOrderAmount, formatOrderDate, orderDateEpoch, orderStatusKey, paymentErrorKey } from "../../utils/adminPayments.js";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
const buttonClass = "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const statusClasses = { PENDING: "bg-amber-50 text-amber-800", PAID: "bg-blue-100 text-blue-800", CANCELLED: "bg-slate-100 text-slate-700" };
const columns = ["orderCode", "buyer", "planCode", "amount", "status", "createdAt", "paidAt"];
const detailFields = ["orderCode", "userId", "buyerName", "buyerEmail", "planCode", "amount", "durationDays", "status", "paymentLinkId", "createdAt", "paidAt", "proExpiresAt"];

function truncateCode(code) {
  const text = String(code ?? "");
  return text.length > 10 ? `${text.slice(0, 4)}…${text.slice(-4)}` : text;
}

function buyerInitials(order) {
  const name = (order.buyerName || "").trim();
  if (name) return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase();
  const local = (order.buyerEmail || "").split("@")[0];
  return (local.slice(0, 2) || "?").toUpperCase();
}

function OrderDetail({ orderCode, t, language, onReconciled }) {
  const { role, profile } = useAuth();
  const [request, setRequest] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  const [reconciliation, setReconciliation] = useState(null);
  const mutation = useRef(null);
  useEffect(() => () => mutation.current?.abort(), []);
  async function reconcile() {
    if (mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    setReconciliation({ loading: true });
    try {
      const order = await reconcileAdminOrder(orderCode, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setRequest({ order });
      setReconciliation({ completed: true });
      onReconciled();
    } catch (error) {
      if (!controller.signal.aborted) setReconciliation({ error: paymentErrorKey(error) });
    } finally {
      if (mutation.current === controller) mutation.current = null;
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    getAdminOrder(orderCode, { signal: controller.signal }).then(
      (order) => { if (!controller.signal.aborted) setRequest({ order }); },
      (error) => { if (!controller.signal.aborted) setRequest({ error: paymentErrorKey(error) }); },
    );
    return () => controller.abort();
  }, [orderCode, retry]);
  return <>
    <RequestState request={request} t={t} onRetry={() => { setRequest({ loading: true }); setRetry((value) => value + 1); }} />
    {request.order && <dl className="mt-5 grid gap-5 sm:grid-cols-2">
      {detailFields.map((field) => {
        const value = request.order[field];
        const display = field === "paidAt" && request.order.status === "PAID" && value == null ? t("adminOrdersMissingPaidAt")
          : ["createdAt", "paidAt", "proExpiresAt"].includes(field) ? formatOrderDate(value, language)
          : field === "amount" ? formatOrderAmount(value, language)
          : field === "status" ? t(orderStatusKey(request.order)) : value ?? "—";
        return <div key={field} className="min-w-0"><dt className="text-sm text-slate-600">{t(`adminOrders_${field}`)}</dt><dd className="mt-1 break-words text-sm font-semibold">{display}</dd></div>;
      })}
    </dl>}
    {role === "ADMIN" && profile?.consoleAccess?.active !== false && request.order && request.order.status !== "CANCELLED" && <div className="mt-6 space-y-3 border-t border-slate-200 pt-5" aria-busy={Boolean(reconciliation?.loading)}>
      <p className="text-sm leading-6 text-slate-600">{t("adminOrdersReconcileHelp")}</p>
      <button type="button" className={buttonClass} disabled={Boolean(reconciliation?.loading)} onClick={reconcile}>
        {t(reconciliation?.loading ? "adminOrdersReconciling" : "adminOrdersReconcile")}
      </button>
      {reconciliation?.loading && <p role="status" className="text-sm text-slate-600">{t("adminOrdersReconciling")}</p>}
      {reconciliation?.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{t(reconciliation.error)}</p>}
      {reconciliation?.completed && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{t("adminOrdersReconciled")}</p>}
    </div>}
  </>;
}

function RequestState({ request, t, onRetry }) {
  if (request.loading) return <p role="status" className="p-5 text-sm text-slate-600">{t("adminOrdersLoading")}</p>;
  if (request.error) return <div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-800"><p>{t(request.error)}</p><button type="button" className={`${buttonClass} mt-3`} onClick={onRetry}>{t("adminOrdersRetry")}</button></div>;
  return null;
}

export default function AdminOrdersPage() {
  const { t, language } = useLanguage();
  const [filters, setFilters] = useState({ status: "", planCode: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [searchCode, setSearchCode] = useState("");
  const [searched, setSearched] = useState(null);
  const [copied, setCopied] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const query = buildOrdersQuery({ ...filters, from: orderDateEpoch(filters.from), to: orderDateEpoch(filters.to, true) }, page, 20);
  const requestKey = `${query}:${retry}`;
  const request = invalidRange ? { error: "adminOrdersDateError" } : result?.key === requestKey ? result : { loading: true };

  useEffect(() => {
    if (invalidRange) return undefined;
    const controller = new AbortController();
    getAdminOrders(query, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key: requestKey, data }); },
      (error) => { if (!controller.signal.aborted) setResult({ key: requestKey, error: paymentErrorKey(error) }); },
    );
    return () => controller.abort();
  }, [query, requestKey, invalidRange]);

  function changeFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(0);
    setExpanded(null);
  }
  function searchOrder(event) {
    event.preventDefault();
    const code = searchCode.trim();
    setExpanded(null);
    setSuggestOpen(false);
    if (!code) { setSearched(null); return; }
    const lower = code.toLowerCase();
    const match = (request.data?.items ?? []).find((order) => String(order.orderCode).toLowerCase().endsWith(lower));
    if (match) { setSearched(null); setExpanded(match.orderCode); return; }
    const byBuyer = (request.data?.items ?? []).find((order) => (order.buyerName || "").toLowerCase().includes(lower) || (order.buyerEmail || "").toLowerCase().includes(lower));
    if (byBuyer) { setSearched(null); setExpanded(byBuyer.orderCode); return; }
    setSearched(code);
  }
  function copyCode(code) {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(String(code)).then(
      () => {
        setCopied(code);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(null), 2000);
      },
      () => {},
    );
  }
  const data = request.data;
  const searchQuery = searchCode.trim().toLowerCase();
  const suggestions = searchQuery ? (data?.items ?? []).filter((order) =>
    String(order.orderCode).toLowerCase().endsWith(searchQuery)
    || (order.buyerName || "").toLowerCase().includes(searchQuery)
    || (order.buyerEmail || "").toLowerCase().includes(searchQuery),
  ).slice(0, 8) : [];

  return <section className="mx-auto max-w-[1500px] space-y-6" aria-labelledby="orders-title">
    <header><h1 id="orders-title" className="text-2xl font-bold text-slate-950 sm:text-3xl">{t("adminOrdersTitle")}</h1><p className="mt-2 text-sm text-slate-600">{t("adminOrdersDescription")}</p></header>
    <form onSubmit={searchOrder} className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-0 flex-1">
        <label className="block text-sm font-semibold">{t("adminOrdersSearchLabel")}
          <input value={searchCode} onChange={(event) => { setSearchCode(event.target.value); setSuggestOpen(true); }} onFocus={() => setSuggestOpen(true)} onBlur={() => setTimeout(() => setSuggestOpen(false), 150)} onKeyDown={(event) => { if (event.key === "Escape") setSuggestOpen(false); }} placeholder={t("adminOrdersSearchPlaceholder")} className={inputClass} role="combobox" aria-expanded={suggestOpen && suggestions.length > 0} aria-controls="orders-search-suggestions" autoComplete="off" />
        </label>
        {suggestOpen && suggestions.length > 0 && <ul id="orders-search-suggestions" role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {suggestions.map((order) => <li key={order.orderCode} role="option" aria-selected={false}>
            <button type="button" onMouseDown={(event) => { event.preventDefault(); setSearchCode(String(order.orderCode)); setSearched(null); setExpanded(order.orderCode); setSuggestOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600">
              <span className="font-semibold">{truncateCode(order.orderCode)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">{order.buyerName || order.buyerEmail || order.userId}</span>
              <span className="whitespace-nowrap text-slate-600">{formatOrderAmount(order.amount, language)}</span>
            </button>
          </li>)}
        </ul>}
      </div>
      <button type="submit" className="sr-only">{t("adminOrdersSearch")}</button>
    </form>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["status", "planCode"].map((field) => <label key={field} className="text-sm font-semibold">{t(`adminOrders_${field}`)}
          <select className={inputClass} value={filters[field]} onChange={(event) => changeFilter(field, event.target.value)}>
            <option value="">{t("adminOrdersAll")}</option>
            {(field === "status" ? ["PENDING", "PAID", "CANCELLED"] : ["PRO_1DAY", "PRO_30"]).map((value) => <option key={value} value={value}>{field === "status" ? t(orderStatusKey({ status: value })) : value}</option>)}
          </select>
        </label>)}
        {["from", "to"].map((field) => (
          <label key={field} className="min-w-0 text-sm font-semibold">
            {t(`adminOrders_${field}`)}
            <input
              type="date"
              className={inputClass}
              value={filters[field]}
              onChange={(event) => changeFilter(field, event.target.value)}
              aria-invalid={invalidRange}
            />
          </label>
        ))}
      </div>
    </div>
    {searched !== null && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-bold">{t("adminOrdersDetail")}</h2><button type="button" onClick={() => { setSearched(null); setSearchCode(""); }} className={buttonClass}>{t("adminOrdersClose")}</button></div>
      <OrderDetail key={searched} orderCode={searched} t={t} language={language} onReconciled={() => setRetry((value) => value + 1)} />
    </div>}
    <div aria-busy={Boolean(request.loading)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <RequestState request={request} t={t} onRetry={() => setRetry((value) => value + 1)} />
      {data && (data.items.length === 0 ? <p role="status" className="p-12 text-center text-sm text-slate-500">{t("adminOrdersEmpty")}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">{t("adminOrdersTitle")}</caption>
        <thead className="bg-slate-50 text-slate-600"><tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{t(`adminOrders_${column}`)}</th>)}<th scope="col" className="w-12 px-2 py-3"><span className="sr-only">{t("adminOrdersDetail")}</span></th></tr></thead>
        <tbody className="divide-y divide-slate-100">{data.items.map((order) => <Fragment key={order.orderCode}>
          <tr className="hover:bg-blue-50/50">
            <td className="px-4 py-3"><span className="flex items-center gap-2"><span className="font-semibold">{truncateCode(order.orderCode)}</span><button type="button" onClick={() => copyCode(order.orderCode)} aria-label={`${t("adminOrdersCopy")} ${order.orderCode}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg></button>{copied === order.orderCode && <span className="whitespace-nowrap text-xs font-semibold text-green-700">{t("adminOrdersCopied")}</span>}</span></td>
            <td className="max-w-64 break-words px-4 py-3"><div className="flex items-start gap-3"><span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{buyerInitials(order)}</span><div className="min-w-0"><p className="font-semibold">{order.buyerName || order.buyerEmail || t("adminOrdersUnknownBuyer")}</p>{order.buyerName && order.buyerEmail && <p className="text-slate-600">{order.buyerEmail}</p>}{!order.buyerName && !order.buyerEmail && <p className="break-all text-slate-600">{order.userId}</p>}</div></div></td>
            <td className="px-4 py-3">{order.planCode}</td><td className="whitespace-nowrap px-4 py-3">{formatOrderAmount(order.amount, language)}</td>
            <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[order.status] || statusClasses.CANCELLED}`}>{t(orderStatusKey(order))}</span></td>
            <td className="whitespace-nowrap px-4 py-3">{formatOrderDate(order.createdAt, language)}</td><td className="whitespace-nowrap px-4 py-3">{order.status === "PAID" && order.paidAt == null ? t("adminOrdersMissingPaidAt") : formatOrderDate(order.paidAt, language)}</td>
            <td className="px-2 py-3"><button type="button" aria-expanded={expanded === order.orderCode} aria-label={expanded === order.orderCode ? t("adminOrdersCollapse") : t("adminOrdersExpand")} onClick={() => setExpanded((current) => current === order.orderCode ? null : order.orderCode)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 transition-transform ${expanded === order.orderCode ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg></button></td>
          </tr>
          {expanded === order.orderCode && <tr><td colSpan={8} className="bg-slate-50 px-4 py-5"><OrderDetail key={order.orderCode} orderCode={order.orderCode} t={t} language={language} onReconciled={() => setRetry((value) => value + 1)} /></td></tr>}
        </Fragment>)}</tbody>
      </table></div>)}
      {data && <nav aria-label={t("adminOrdersPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
        <button type="button" disabled={page <= 0} className={buttonClass} onClick={() => { setExpanded(null); setPage((value) => value - 1); }}>{t("adminOrdersPrevious")}</button>
        <p role="status" className="text-sm text-slate-600">{t("adminOrdersPage").replace("{page}", data.totalPages ? page + 1 : 0).replace("{total}", data.totalPages)}</p>
        <button type="button" disabled={page + 1 >= data.totalPages} className={buttonClass} onClick={() => { setExpanded(null); setPage((value) => value + 1); }}>{t("adminOrdersNext")}</button>
      </nav>}
    </div>
  </section>;
}
