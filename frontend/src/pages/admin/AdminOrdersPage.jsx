import { useEffect, useRef, useState } from "react";
import { getAdminOrder, getAdminOrders, reconcileAdminOrder } from "../../api/adminPayments.js";
import { useLanguage } from "../../i18n/LanguageContext";
import { buildOrdersQuery, formatOrderAmount, formatOrderDate, orderDateEpoch, orderStatusKey, paymentErrorKey } from "./adminPayments.js";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
const buttonClass = "min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const statusClasses = { PENDING: "bg-amber-50 text-amber-800", PAID: "bg-green-50 text-green-800", CANCELLED: "bg-slate-100 text-slate-700" };
const columns = ["orderCode", "buyer", "planCode", "amount", "status", "createdAt", "paidAt"];
const detailFields = ["orderCode", "userId", "buyerName", "buyerEmail", "planCode", "amount", "durationDays", "status", "paymentLinkId", "createdAt", "paidAt", "proExpiresAt"];

function OrderDetail({ orderCode, t, language, onReconciled }) {
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
        const display = ["createdAt", "paidAt", "proExpiresAt"].includes(field) ? formatOrderDate(value, language)
          : field === "amount" ? formatOrderAmount(value, language)
          : field === "status" ? t(orderStatusKey(request.order)) : value ?? "—";
        return <div key={field} className="min-w-0"><dt className="text-sm text-slate-600">{t(`adminOrders_${field}`)}</dt><dd className="mt-1 break-words text-sm font-semibold">{display}</dd></div>;
      })}
    </dl>}
    {request.order && request.order.status !== "CANCELLED" && <div className="mt-6 space-y-3 border-t border-slate-200 pt-5" aria-busy={Boolean(reconciliation?.loading)}>
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
  const [filters, setFilters] = useState({ status: "", planCode: "", userId: "", from: "", to: "" });
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const dialog = useRef(null);
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
  }
  function openOrder(orderCode) {
    setSelected(orderCode);
    dialog.current.showModal();
  }
  const data = request.data;

  return <section className="mx-auto max-w-7xl space-y-6" aria-labelledby="orders-title">
    <header><h1 id="orders-title" className="text-2xl font-bold text-slate-950 sm:text-3xl">{t("adminOrdersTitle")}</h1><p className="mt-2 text-sm text-slate-600">{t("adminOrdersDescription")}</p></header>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {["status", "planCode"].map((field) => <label key={field} className="text-sm font-semibold">{t(`adminOrders_${field}`)}
          <select className={inputClass} value={filters[field]} onChange={(event) => changeFilter(field, event.target.value)}>
            <option value="">{t("adminOrdersAll")}</option>
            {(field === "status" ? ["PENDING", "PAID", "CANCELLED"] : ["PRO_1DAY", "PRO_30"]).map((value) => <option key={value} value={value}>{field === "status" ? t(orderStatusKey({ status: value })) : value}</option>)}
          </select>
        </label>)}
        {["from", "to", "userId"].map((field) => <label key={field} className="min-w-0 text-sm font-semibold">{t(`adminOrders_${field}`)}<input type={field === "userId" ? "text" : "date"} className={inputClass} value={filters[field]} onChange={(event) => changeFilter(field, event.target.value)} aria-invalid={field !== "userId" && invalidRange} aria-describedby={field !== "userId" ? "orders-date-help" : undefined} /></label>)}
      </div>
      <p id="orders-date-help" className="mt-3 text-sm text-slate-600">{t("adminOrdersDateHelp")}</p>
    </div>
    <div aria-busy={Boolean(request.loading)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <RequestState request={request} t={t} onRetry={() => setRetry((value) => value + 1)} />
      {data && (data.items.length === 0 ? <p role="status" className="p-6 text-sm text-slate-600">{t("adminOrdersEmpty")}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">{t("adminOrdersTitle")}</caption>
        <thead className="bg-slate-50 text-slate-600"><tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{t(`adminOrders_${column}`)}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{data.items.map((order) => <tr key={order.orderCode} onClick={() => openOrder(order.orderCode)} className="cursor-pointer hover:bg-blue-50/50">
          <td className="px-4 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); openOrder(order.orderCode); }} aria-label={`${t("adminOrdersDetail")} ${order.orderCode}`} className="min-h-11 font-semibold text-blue-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">{order.orderCode}</button></td>
          <td className="max-w-64 break-words px-4 py-3"><p className="font-semibold">{order.buyerName || order.buyerEmail || t("adminOrdersUnknownBuyer")}</p>{order.buyerName && order.buyerEmail && <p className="text-slate-600">{order.buyerEmail}</p>}{!order.buyerName && !order.buyerEmail && <p className="break-all text-slate-600">{order.userId}</p>}</td>
          <td className="px-4 py-3">{order.planCode}</td><td className="whitespace-nowrap px-4 py-3">{formatOrderAmount(order.amount, language)}</td>
          <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[order.status] || statusClasses.CANCELLED}`}>{t(orderStatusKey(order))}</span></td>
          <td className="whitespace-nowrap px-4 py-3">{formatOrderDate(order.createdAt, language)}</td><td className="whitespace-nowrap px-4 py-3">{formatOrderDate(order.paidAt, language)}</td>
        </tr>)}</tbody>
      </table></div>)}
      {data && <nav aria-label={t("adminOrdersPagination")} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
        <button type="button" disabled={page <= 0} className={buttonClass} onClick={() => setPage((value) => value - 1)}>{t("adminOrdersPrevious")}</button>
        <p role="status" className="text-sm text-slate-600">{t("adminOrdersPage").replace("{page}", data.totalPages ? page + 1 : 0).replace("{total}", data.totalPages)}</p>
        <button type="button" disabled={page + 1 >= data.totalPages} className={buttonClass} onClick={() => setPage((value) => value + 1)}>{t("adminOrdersNext")}</button>
      </nav>}
    </div>
    <dialog ref={dialog} onClose={() => setSelected(null)} aria-labelledby="orders-detail-title" className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <div className="flex items-center justify-between gap-4"><h2 id="orders-detail-title" className="text-lg font-bold">{t("adminOrdersDetail")}</h2><button type="button" autoFocus className={buttonClass} onClick={() => dialog.current.close()}>{t("adminOrdersClose")}</button></div>
      {selected !== null && <OrderDetail key={selected} orderCode={selected} t={t} language={language} onReconciled={() => setRetry((value) => value + 1)} />}
    </dialog>
  </section>;
}
