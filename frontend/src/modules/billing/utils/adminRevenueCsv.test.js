import assert from "node:assert/strict";
import test from "node:test";
import { buildRevenueCsv } from "./adminRevenueCsv.js";
import { translations } from "../../../i18n/translations.js";

const sampleReport = {
  totalRevenue: 109000,
  paidOrderCount: 2,
  totalOrderCount: 14,
  successRate: 0.286,
  averageOrderValue: 54500,
  series: [
    { period: "2026-11-07", revenue: 10000, orders: 1 },
    { period: "2026-11-09", revenue: 99000, orders: 1 },
  ],
  byPlan: [
    { planCode: "PRO_30", orders: 1, revenue: 99000 },
    { planCode: "PRO_1DAY", orders: 1, revenue: 10000 },
  ],
};

test("csv starts with a UTF-8 BOM and uses CRLF line endings", () => {
  const csv = buildRevenueCsv(sampleReport);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("\r\n"));
  assert.ok(!csv.startsWith("\uFEFF\uFEFF"));
});

test("amounts are raw numbers, never compact chart labels", () => {
  const csv = buildRevenueCsv(sampleReport);
  assert.ok(csv.includes("109000"));
  assert.ok(csv.includes("99000"));
  assert.ok(!csv.includes("99 N"));
  assert.ok(!csv.includes("109 N"));
});

test("commas and quotes inside values are escaped", () => {
  const csv = buildRevenueCsv({
    ...sampleReport,
    byPlan: [{ planCode: 'PRO_"30, VIP"', orders: 1, revenue: 99000 }],
  });
  assert.ok(csv.includes('"PRO_""30, VIP"""'));
});

test("empty series and byPlan still produce all three sections without crashing", () => {
  const csv = buildRevenueCsv({ ...sampleReport, series: [], byPlan: [] });
  assert.ok(csv.includes("BÁO CÁO DOANH THU"));
  assert.ok(csv.includes("Doanh thu theo kỳ"));
  assert.ok(csv.includes("Doanh thu theo gói"));
  assert.ok(csv.includes("Kỳ,Doanh thu (VND),Số đơn"));
});

test("plan shares add up and divide-by-zero is guarded", () => {
  const csv = buildRevenueCsv(sampleReport);
  assert.ok(csv.includes("PRO_30,1,99000,90.8"));
  assert.ok(csv.includes("PRO_1DAY,1,10000,9.2"));
  const zero = buildRevenueCsv({
    ...sampleReport,
    totalRevenue: 0,
    byPlan: [{ planCode: "PRO_30", orders: 0, revenue: 0 }],
  });
  assert.ok(zero.includes("PRO_30,0,0,0.0"));
});

test("missing report returns an empty string", () => {
  assert.equal(buildRevenueCsv(null), "");
  assert.equal(buildRevenueCsv(undefined), "");
});

test("conversion rate is written as a percent number", () => {
  const csv = buildRevenueCsv(sampleReport);
  assert.ok(csv.includes("Tỉ lệ chuyển đổi (%),28.6"));
});

test("export key exists in both languages", () => {
  assert.ok(translations.en.adminRevenueExportCsv);
  assert.ok(translations.vi.adminRevenueExportCsv);
});
