import { useEffect, useId, useState } from "react";
import { getAdminRevenue } from "../../api/adminPayments.js";
import { useLanguage } from "../../i18n/LanguageContext";
import { formatOrderAmount, formatOrderDate, orderDateEpoch } from "./adminPayments.js";
import { buildRevenueQuery, revenueErrorKey, revenuePresets } from "./adminRevenue.js";

const inputClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600";
const buttonClass = "min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";

function presetRange(key) {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const days = key === "30d" ? 29 : 6;
  const from = key === "month" ? `${today.slice(0, 7)}-01`
    : new Date(orderDateEpoch(today) + 7 * 60 * 60 * 1000 - days * 86_400_000).toISOString().slice(0, 10);
  return { preset: key, from, to: today };
}

function RevenueChart({ series, t, language }) {
  const chartId = useId();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const width = Math.max(1000, series.length * 76 + 110);
  const left = 85;
  const top = 20;
  const height = 210;
  const plotWidth = width - left - 20;
  const slot = plotWidth / Math.max(1, series.length);
  const max = Math.max(4, ...series.map((point) => point.revenue));
  const axisFormat = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  if (!series.length) return <p role="status" className="mt-5 text-sm text-slate-600">{t("adminRevenueChartEmpty")}</p>;

  return <>
    <p className="mt-2 text-sm text-slate-600">{t("adminRevenueChartHelp")}</p>
    <div className="mt-4 overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600" tabIndex={0} role="region" aria-label={t("adminRevenueChartScroll")}>
      <svg width={width} height="285" viewBox={`0 0 ${width} 285`} role="img" aria-labelledby={`${chartId}-title ${chartId}-description`} className="h-auto min-w-full text-slate-600">
        <title id={`${chartId}-title`}>{t("adminRevenueChart")}</title>
        <desc id={`${chartId}-description`}>{t("adminRevenueChartAccessible")}</desc>
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = top + height - tick / 4 * height;
          return <g key={tick}><line x1={left} x2={width - 20} y1={y} y2={y} className="stroke-slate-200" /><text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="currentColor">{axisFormat.format(max * tick / 4)}</text></g>;
        })}
        {series.map((point, index) => {
          const barHeight = point.revenue / max * height;
          const x = left + index * slot + slot * 0.2;
          return <g key={point.period}>
            <title>{`${point.period}: ${formatOrderAmount(point.revenue, language)}; ${t("adminRevenueOrders")}: ${point.orders}`}</title>
            <rect x={x} y={top + height - barHeight} width={slot * 0.6} height={barHeight} rx="3" className="fill-blue-600" />
            <text x={left + (index + 0.5) * slot} y={top + height + 24} textAnchor="middle" fontSize="11" fill="currentColor">{point.period}</text>
          </g>;
        })}
      </svg>
    </div>
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer rounded-lg py-3 font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{t("adminRevenueChartData")}</summary>
      <div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-left">
        <caption className="sr-only">{t("adminRevenueChartData")}</caption>
        <thead><tr>{["Period", "Orders", "Revenue"].map((key) => <th key={key} scope="col" className="px-3 py-2">{t(`adminRevenue${key}`)}</th>)}</tr></thead>
        <tbody>{series.map((point) => <tr key={point.period} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap px-3 py-2 font-normal">{point.period}</th><td className="px-3 py-2">{point.orders}</td><td className="whitespace-nowrap px-3 py-2">{formatOrderAmount(point.revenue, language)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </>;
}

export default function AdminRevenuePage() {
  const { t, language } = useLanguage();
  const [range, setRange] = useState(() => presetRange("7d"));
  const [granularity, setGranularity] = useState("day");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const invalidRange = !range.from || !range.to || range.from > range.to;
  const query = buildRevenueQuery({ ...range, granularity });
  const requestKey = `${query}:${retry}`;
  const request = invalidRange ? { error: "adminRevenueDateError" } : result?.key === requestKey ? result : { loading: true };
  const report = request.report;
  const percent = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", { style: "percent", maximumFractionDigits: 1 });

  useEffect(() => {
    if (invalidRange) return undefined;
    const controller = new AbortController();
    getAdminRevenue(query, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key: requestKey, report: data }); },
      (error) => { if (!controller.signal.aborted) setResult({ key: requestKey, error: revenueErrorKey(error) }); },
    );
    return () => controller.abort();
  }, [query, requestKey, invalidRange]);

  function selectPreset(key) {
    setRange((current) => key === "custom" ? { ...current, preset: key } : presetRange(key));
  }

  return <section className="mx-auto max-w-7xl space-y-6" aria-labelledby="revenue-title">
    <header><h1 id="revenue-title" className="text-2xl font-bold text-slate-950 sm:text-3xl">{t("adminRevenueTitle")}</h1><p className="mt-2 text-sm text-slate-600">{t("adminRevenueDescription")}</p></header>
    <div className={panelClass}>
      <fieldset><legend className="text-sm font-semibold">{t("adminRevenueRange")}</legend>
        <div className="mt-3 flex flex-wrap gap-2">{revenuePresets().map(({ key }) => <button key={key} type="button" aria-pressed={range.preset === key} onClick={() => selectPreset(key)} className={`${buttonClass} ${range.preset === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{t(`adminRevenuePreset_${key}`)}</button>)}</div>
      </fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {range.preset === "custom" && ["from", "to"].map((field) => <label key={field} className="min-w-0 text-sm font-semibold">{t(`adminRevenue_${field}`)}<input type="date" value={range[field]} className={inputClass} onChange={(event) => setRange((current) => ({ ...current, [field]: event.target.value }))} aria-invalid={invalidRange} aria-describedby="revenue-range-help" /></label>)}
        <label className="text-sm font-semibold">{t("adminRevenueGranularity")}<select value={granularity} onChange={(event) => setGranularity(event.target.value)} className={inputClass}><option value="day">{t("adminRevenueDay")}</option><option value="month">{t("adminRevenueMonth")}</option></select></label>
      </div>
      <p id="revenue-range-help" className="mt-4 text-sm text-slate-600">{t("adminRevenueDateHelp")}</p>
      {!invalidRange && <p className="mt-2 text-sm text-slate-700">{formatOrderDate(orderDateEpoch(range.from), language)} – {formatOrderDate(orderDateEpoch(range.to, true), language)}</p>}
    </div>

    <div aria-busy={Boolean(request.loading)}>
      {request.loading && <p role="status" className={`${panelClass} text-sm text-slate-600`}>{t("adminRevenueLoading")}</p>}
      {request.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{t(request.error)}</p>{!invalidRange && <button type="button" onClick={() => setRetry((value) => value + 1)} className={`${buttonClass} mt-3 border-red-300 hover:bg-red-100`}>{t("adminRevenueRetry")}</button>}</div>}
      {report && <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["TotalRevenue", formatOrderAmount(report.totalRevenue, language)],
            ["PaidOrders", report.paidOrderCount],
            ["SuccessRate", percent.format(report.successRate)],
            ["AverageOrder", formatOrderAmount(report.averageOrderValue, language)],
          ].map(([key, value]) => <div key={key} className={panelClass}><h2 className="text-sm font-semibold text-slate-600">{t(`adminRevenue${key}`)}</h2><p className="mt-3 break-words text-2xl font-bold text-slate-950">{value}</p></div>)}
        </div>
        <div className="space-y-2 text-sm text-slate-600"><p>{t("adminRevenueSuccessHelp").replace("{count}", report.totalOrderCount)}</p><p>{t("adminRevenueMissingDateHelp")}</p></div>
        {report.paidOrderCount === 0 && <p role="status" className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">{t("adminRevenueEmpty")}</p>}
        <section className={panelClass} aria-labelledby="revenue-chart-title"><h2 id="revenue-chart-title" className="text-lg font-bold">{t("adminRevenueChart")}</h2><RevenueChart series={report.series} t={t} language={language} /></section>
        <section className={panelClass} aria-labelledby="revenue-plans-title"><h2 id="revenue-plans-title" className="text-lg font-bold">{t("adminRevenuePlans")}</h2>
          {!report.byPlan.length ? <p className="mt-4 text-sm text-slate-600">{t("adminRevenueChartEmpty")}</p> : <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
            <caption className="sr-only">{t("adminRevenuePlans")}</caption>
            <thead className="bg-slate-50 text-slate-600"><tr>{["Plan", "Orders", "Revenue", "Share"].map((key) => <th key={key} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{t(`adminRevenue${key}`)}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{report.byPlan.map((plan) => <tr key={plan.planCode ?? "unknown"}><th scope="row" className="px-4 py-3 font-semibold">{plan.planCode || "—"}</th><td className="px-4 py-3">{plan.orders}</td><td className="whitespace-nowrap px-4 py-3">{formatOrderAmount(plan.revenue, language)}</td><td className="px-4 py-3">{percent.format(report.totalRevenue ? plan.revenue / report.totalRevenue : 0)}</td></tr>)}</tbody>
          </table></div>}
        </section>
      </div>}
    </div>
  </section>;
}
