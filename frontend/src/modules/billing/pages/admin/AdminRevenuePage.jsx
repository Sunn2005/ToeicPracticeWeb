import { useEffect, useId, useState } from "react";
import { getAdminRevenue } from "../../../../api/billing/adminPayments.js";
import { useLanguage } from "../../../../i18n/LanguageContext";
import { formatOrderAmount, formatOrderDate, orderDateEpoch } from "../../utils/adminPayments.js";
import { buildRevenueQuery, revenueErrorKey, revenuePresets } from "../../utils/adminRevenue.js";
import { buildRevenueCsv, downloadCsv } from "../../utils/adminRevenueCsv.js";

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
  const maxRevenue = Math.max(0, ...series.map((point) => point.revenue));
  const axisFormat = new Intl.NumberFormat(locale);
  if (!series.length) return <p role="status" className="mt-5 text-sm text-slate-600">{t("adminRevenueChartEmpty")}</p>;

  return <>
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
          const isMax = maxRevenue > 0 && point.revenue === maxRevenue;
          return <g key={point.period}>
            <title>{`${point.period}: ${formatOrderAmount(point.revenue, language)}; ${t("adminRevenueOrders")}: ${point.orders}`}</title>
            <rect x={x} y={top + height - barHeight} width={slot * 0.6} height={barHeight} rx="3" className={isMax ? "fill-blue-800" : "fill-blue-600"} />
            {isMax && <text x={left + (index + 0.5) * slot} y={top + height - barHeight - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e40af">{formatOrderAmount(point.revenue, language)}</text>}
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

function shortPeriod(period) {
  return period.length === 7 ? period : `${period.slice(8, 10)}/${period.slice(5, 7)}`;
}

function shortDate(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function previousRange(from, to) {
  const fromDay = Date.parse(from);
  const length = Math.round((Date.parse(to) - fromDay) / 86400000) + 1;
  return {
    from: new Date(fromDay - length * 86400000).toISOString().slice(0, 10),
    to: new Date(fromDay - 86400000).toISOString().slice(0, 10),
  };
}

function Sparkline({ values, color = "text-blue-600" }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 36;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${height - 4 - ((value - min) / range) * (height - 8)}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={`mt-3 ${color}`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function CumulativeChart({ series, previousSeries, t, language }) {
  const chartId = useId();
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const totals = [];
  let running = 0;
  for (const point of series) { running += point.revenue; totals.push({ ...point, total: running }); }
  const showPrevious = Array.isArray(previousSeries) && previousSeries.length === series.length && series.length > 0;
  const prevTotals = [];
  if (showPrevious) { let prevRunning = 0; for (const point of previousSeries) { prevRunning += point.revenue; prevTotals.push(prevRunning); } }
  const width = Math.max(1000, series.length * 76 + 110);
  const left = 85;
  const top = 20;
  const height = 210;
  const plotWidth = width - left - 20;
  const slot = plotWidth / Math.max(1, series.length);
  const max = Math.max(4, ...totals.map((point) => point.total), ...prevTotals);
  const axisFormat = new Intl.NumberFormat(locale);
  if (!series.length) return <p role="status" className="mt-5 text-sm text-slate-600">{t("adminRevenueChartEmpty")}</p>;
  const points = totals.map((point, index) => [left + (index + 0.5) * slot, top + height - point.total / max * height]);
  const prevPoints = prevTotals.map((total, index) => [left + (index + 0.5) * slot, top + height - total / max * height]);
  const baseline = top + height;
  const areaPath = points.length ? `M ${points[0][0]},${baseline} L ${points.map((point) => point.join(",")).join(" L ")} L ${points[points.length - 1][0]},${baseline} Z` : "";
  const last = totals[totals.length - 1];
  let jumpIndex = 0;
  series.forEach((point, index) => { if (point.revenue > series[jumpIndex].revenue) jumpIndex = index; });
  const jump = series[jumpIndex].revenue > 0 && jumpIndex !== totals.length - 1
    ? { period: series[jumpIndex].period, revenue: series[jumpIndex].revenue, x: points[jumpIndex][0], y: points[jumpIndex][1] }
    : null;

  return <>
    {showPrevious && <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-slate-600">
      <span className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-0.5 w-6 bg-blue-600" />{t("adminRevenueCurrentPeriod")}</span>
      <span className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-0 w-6 border-t-2 border-dashed border-orange-600" />{t("adminRevenuePreviousPeriod")}</span>
    </div>}
    <div className="mt-4 overflow-x-auto rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600" tabIndex={0} role="region" aria-label={t("adminRevenueChartScroll")}>
      <svg width={width} height="285" viewBox={`0 0 ${width} 285`} role="img" aria-labelledby={`${chartId}-title ${chartId}-description`} className="h-auto min-w-full text-slate-600">
        <title id={`${chartId}-title`}>{t("adminRevenueCumulative")}</title>
        <desc id={`${chartId}-description`}>{t("adminRevenueCumulativeHelp")}</desc>
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = top + height - tick / 4 * height;
          return <g key={tick}><line x1={left} x2={width - 20} y1={y} y2={y} className="stroke-slate-200" /><text x={left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="currentColor">{axisFormat.format(max * tick / 4)}</text></g>;
        })}
        {areaPath && <path d={areaPath} fill="#2563eb" fillOpacity="0.08" />}
        {showPrevious && <polyline points={prevPoints.map((point) => point.join(",")).join(" ")} fill="none" stroke="#ea580c" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />}
        <polyline points={points.map((point) => point.join(",")).join(" ")} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-blue-600" />
        {last && <text x={width - 20} y={14} textAnchor="end" fontSize="12" fontWeight="700" fill="#2563eb">{`${shortPeriod(last.period)}: ${formatOrderAmount(last.total, language)}`}</text>}
        {jump && <text x={jump.x} y={jump.y - 10 < 24 ? jump.y + 22 : jump.y - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#2563eb">{`${shortPeriod(jump.period)}: +${formatOrderAmount(jump.revenue, language)}`}</text>}
        {totals.map((point, index) => <g key={point.period}>
          <title>{`${point.period}: ${formatOrderAmount(point.total, language)}`}</title>
          <circle cx={points[index][0]} cy={points[index][1]} r="4" className="fill-blue-600" />
          <text x={points[index][0]} y={top + height + 24} textAnchor="middle" fontSize="11" fill="currentColor">{point.period}</text>
        </g>)}
      </svg>
    </div>
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer rounded-lg py-3 font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{t("adminRevenueChartData")}</summary>
      <div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-left">
        <caption className="sr-only">{t("adminRevenueCumulative")}</caption>
        <thead><tr>{["Period", "Revenue"].map((key) => <th key={key} scope="col" className="px-3 py-2">{t(`adminRevenue${key}`)}</th>)}</tr></thead>
        <tbody>{totals.map((point) => <tr key={point.period} className="border-t border-slate-100"><th scope="row" className="whitespace-nowrap px-3 py-2 font-normal">{point.period}</th><td className="whitespace-nowrap px-3 py-2">{formatOrderAmount(point.total, language)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </>;
}

function DayList({ series, t, language }) {
  if (!series.length) return <p role="status" className="mt-4 text-sm text-slate-600">{t("adminRevenueChartEmpty")}</p>;
  return <ul className="mt-4 max-h-80 space-y-1 overflow-auto pr-1">
    {series.map((point) => <li key={point.period} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${point.revenue > 0 ? "bg-blue-600" : "bg-slate-300"}`} />
      <span className="min-w-0 flex-1 whitespace-nowrap">{point.period}</span>
      <span className="whitespace-nowrap text-slate-600">{t("adminRevenueOrders")}: {point.orders}</span>
      <span className={`whitespace-nowrap font-semibold ${point.revenue > 0 ? "text-blue-700" : "text-slate-700"}`}>{formatOrderAmount(point.revenue, language)}</span>
    </li>)}
  </ul>;
}

function renderInsight(text, values) {
  return text.split(/(\{[a-z]+\})/g).map((part, index) => values[part] ? <b key={index}>{values[part]}</b> : <span key={index}>{part}</span>);
}

const donutColors = ["#2563eb", "#d97706", "#059669", "#7c3aed", "#db2777", "#0891b2"];

function PlanDonut({ plans, totalRevenue, percent, t, language }) {
  const [selected, setSelected] = useState(null);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const shares = plans.map((plan) => totalRevenue > 0 ? plan.revenue / totalRevenue : 0);
  const segments = plans.map((plan, index) => ({
    ...plan,
    share: shares[index],
    color: donutColors[index % donutColors.length],
    offset: shares.slice(0, index).reduce((sum, share) => sum + share, 0) * circumference,
  }));
  const active = selected === null ? null : segments[selected];
  const totalOrders = plans.reduce((sum, plan) => sum + (plan.orders || 0), 0);
  return <div>
    <div className="mt-4 flex flex-col items-stretch gap-4">
      <div className="relative mx-auto w-fit">
        <svg width="200" height="200" viewBox="0 0 200 200" role="img" aria-label={t("adminRevenuePlans")} className="block">
          <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="26" className="stroke-slate-100" />
          {segments.map((segment, index) => <circle key={segment.planCode ?? index} cx="100" cy="100" r={radius} fill="none" strokeWidth="26" stroke={segment.color} strokeDasharray={`${segment.share * circumference} ${circumference}`} strokeDashoffset={-segment.offset} transform="rotate(-90 100 100)" onClick={() => setSelected(selected === index ? null : index)} className={`cursor-pointer transition-opacity ${selected !== null && selected !== index ? "opacity-25" : ""}`}>
            <title>{`${segment.planCode}: ${formatOrderAmount(segment.revenue, language)}`}</title>
          </circle>)}
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="w-[132px] text-sm font-semibold leading-tight text-slate-700">{active ? active.planCode : t("adminRevenueDonutAll")}</span>
          <span className="mt-0.5 w-[132px] break-words text-lg font-bold leading-tight text-slate-950">{formatOrderAmount(active ? active.revenue : totalRevenue, language)}</span>
          <span className="mt-0.5 w-[132px] text-xs leading-tight text-slate-500">{active ? t("adminRevenueDonutSelectedSub").replace("{orders}", active.orders).replace("{share}", percent.format(active.share)) : t("adminRevenueDonutTotalSub").replace("{count}", totalOrders)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {segments.map((segment, index) => <li key={segment.planCode ?? index}><button type="button" aria-pressed={selected === index} onClick={() => setSelected(selected === index ? null : index)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 ${selected === index ? "bg-blue-50" : ""}`}>
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} />
          <span className="min-w-0 flex-1 truncate font-semibold">{segment.planCode || "—"}</span>
          <span className="whitespace-nowrap">{formatOrderAmount(segment.revenue, language)}</span>
        </button></li>)}
      </ul>
    </div>
    {active && <p role="status" className="mt-4 text-sm text-slate-600">{t("adminRevenueDonutDetail").replace("{plan}", active.planCode).replace("{orders}", active.orders).replace("{share}", percent.format(active.share))}</p>}
  </div>;
}

export default function AdminRevenuePage() {
  const { t, language } = useLanguage();
  const [range, setRange] = useState(() => presetRange("7d"));
  const [granularity, setGranularity] = useState("day");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const [previousResult, setPreviousResult] = useState(null);
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

  const prevRange = invalidRange ? null : previousRange(range.from, range.to);
  const prevQuery = prevRange ? buildRevenueQuery({ ...prevRange, granularity }) : null;
  const prevRequestKey = prevQuery ? `${prevQuery}:${retry}` : null;
  useEffect(() => {
    if (invalidRange || !prevQuery) return undefined;
    const controller = new AbortController();
    getAdminRevenue(prevQuery, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setPreviousResult({ key: prevRequestKey, report: data }); },
      () => { if (!controller.signal.aborted) setPreviousResult({ key: prevRequestKey, report: null }); },
    );
    return () => controller.abort();
  }, [prevQuery, prevRequestKey, invalidRange]);
  const previousSeries = previousResult?.key === prevRequestKey ? previousResult.report?.series ?? null : null;

  function selectPreset(key) {
    setRange((current) => key === "custom" ? { ...current, preset: key } : presetRange(key));
  }

  function exportCsv() {
    if (!report) return;
    downloadCsv(
      `doanh-thu-${range.from}-${range.to}.csv`,
      buildRevenueCsv(report, {
        granularityLabel: t(granularity === "day" ? "adminRevenueDay" : "adminRevenueMonth"),
        fromLabel: formatOrderDate(orderDateEpoch(range.from), language),
        toLabel: formatOrderDate(orderDateEpoch(range.to, true), language),
      }),
    );
  }

  return <section className="mx-auto max-w-[1500px] space-y-6">
    <header><p className="text-sm text-slate-600">{t("adminRevenueDescription")}</p></header>
    <div className={panelClass}>
      <fieldset><legend className="text-sm font-semibold">{t("adminRevenueRange")}</legend>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">{revenuePresets().map(({ key }) => <button key={key} type="button" aria-pressed={range.preset === key} onClick={() => selectPreset(key)} className={`${buttonClass} ${range.preset === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>{t(`adminRevenuePreset_${key}`)}</button>)}</div>
          <button type="button" disabled={!report} onClick={exportCsv} className={`${buttonClass} flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50`}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m6 11 6 6 6-6" /><path d="M4 21h16" /></svg>{t("adminRevenueExportCsv")}</button>
        </div>
      </fieldset>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {range.preset === "custom" && ["from", "to"].map((field) => <label key={field} className="min-w-0 text-sm font-semibold">{t(`adminRevenue_${field}`)}<input type="date" value={range[field]} className={inputClass} onChange={(event) => setRange((current) => ({ ...current, [field]: event.target.value }))} aria-invalid={invalidRange} /></label>)}
        <label className="text-sm font-semibold">{t("adminRevenueGranularity")}<select value={granularity} onChange={(event) => setGranularity(event.target.value)} className={inputClass}><option value="day">{t("adminRevenueDay")}</option><option value="month">{t("adminRevenueMonth")}</option></select></label>
      </div>
      {!invalidRange && <p className="mt-2 text-sm text-slate-700">{formatOrderDate(orderDateEpoch(range.from), language)} – {formatOrderDate(orderDateEpoch(range.to, true), language)}</p>}
    </div>

    <div aria-busy={Boolean(request.loading)}>
      {request.loading && <p role="status" className={`${panelClass} text-sm text-slate-600`}>{t("adminRevenueLoading")}</p>}
      {request.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{t(request.error)}</p>{!invalidRange && <button type="button" onClick={() => setRetry((value) => value + 1)} className={`${buttonClass} mt-3 border-red-300 hover:bg-red-100`}>{t("adminRevenueRetry")}</button>}</div>}
      {report && <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-slate-700">
          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-blue-600"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></svg>
          <p>{renderInsight(t("adminRevenueInsight"), {
            "{from}": formatOrderDate(orderDateEpoch(range.from), language),
            "{to}": formatOrderDate(orderDateEpoch(range.to, true), language),
            "{revenue}": formatOrderAmount(report.totalRevenue, language),
            "{paid}": report.paidOrderCount,
            "{total}": report.totalOrderCount,
          })}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { key: "TotalRevenue", value: formatOrderAmount(report.totalRevenue, language), spark: report.series.map((point) => point.revenue), sparkColor: "text-blue-600", icon: <><path d="M3 17l5.5-5.5 3.5 3.5L20 7" /><path d="M14 7h6v6" /></>, iconClass: "bg-blue-50 text-blue-600", meta: t("adminRevenueMetaPeriod").replace("{from}", shortDate(range.from)).replace("{to}", shortDate(range.to)) },
            { key: "PaidOrders", value: report.paidOrderCount, spark: report.series.map((point) => point.orders), sparkColor: "text-green-700", icon: <path d="M20 6 9 17l-5-5" />, iconClass: "bg-green-50 text-green-700", meta: t("adminRevenueMetaCreated").replace("{count}", report.totalOrderCount) },
            { key: "SuccessRate", value: percent.format(report.successRate), spark: null, sub: t("adminRevenueRateSub").replace("{paid}", report.paidOrderCount).replace("{total}", report.totalOrderCount), icon: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="17" r="2.4" /></>, iconClass: "bg-violet-50 text-violet-600", meta: t("adminRevenueMetaSamePeriod") },
            { key: "AverageOrder", value: formatOrderAmount(report.averageOrderValue, language), spark: report.series.map((point) => point.orders > 0 ? point.revenue / point.orders : 0), sparkColor: "text-amber-600", icon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>, iconClass: "bg-amber-50 text-amber-600", meta: t("adminRevenueMetaAverage").replace("{count}", report.paidOrderCount) },
          ].map(({ key, value, spark, sparkColor, sub, icon, iconClass, meta }) => <div key={key} className={panelClass}>
            <div className="flex items-start justify-between gap-2">
              <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconClass}`}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-right text-xs font-medium leading-5 text-slate-600">{meta}</span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-slate-600">{t(`adminRevenue${key}`)}</h2>
            <p className="mt-1 break-words text-2xl font-bold text-slate-950">{value}</p>
            {sub && <p className="mt-1 text-sm text-slate-600">{sub}</p>}
            {spark && <Sparkline values={spark} color={sparkColor} />}
          </div>)}
        </div>
        {report.paidOrderCount === 0 && <p role="status" className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">{t("adminRevenueEmpty")}</p>}
        <section className={panelClass} aria-labelledby="revenue-chart-title"><h2 id="revenue-chart-title" className="text-lg font-bold">{t("adminRevenueChart")}</h2><RevenueChart series={report.series} t={t} language={language} /></section>
        <section className={panelClass} aria-labelledby="revenue-cumulative-title"><h2 id="revenue-cumulative-title" className="text-lg font-bold">{t("adminRevenueCumulative")}</h2><CumulativeChart series={report.series} previousSeries={previousSeries} t={t} language={language} /></section>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className={panelClass} aria-labelledby="revenue-daylist-title"><h2 id="revenue-daylist-title" className="text-lg font-bold">{t(granularity === "day" ? "adminRevenueDayList" : "adminRevenueMonthList")}</h2><DayList series={report.series} t={t} language={language} /></section>
          <section className={panelClass} aria-labelledby="revenue-plans-title"><h2 id="revenue-plans-title" className="text-lg font-bold">{t("adminRevenuePlans")}</h2>
            {!report.byPlan.length ? <p className="mt-4 text-sm text-slate-600">{t("adminRevenueChartEmpty")}</p> : <PlanDonut plans={report.byPlan} totalRevenue={report.totalRevenue} percent={percent} t={t} language={language} />}
          </section>
        </div>
      </div>}
    </div>
  </section>;
}
