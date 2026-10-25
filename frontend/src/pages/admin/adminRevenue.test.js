import assert from "node:assert/strict";
import test from "node:test";
import { buildRevenueQuery, revenuePresets, revenueErrorKey } from "./adminRevenue.js";
import { translations } from "../../i18n/translations.js";

test("revenue query uses whole Vietnam days and selected grouping", () => {
  const query = new URLSearchParams(buildRevenueQuery({ from: "2026-10-24", to: "2026-10-25", granularity: "month" }));
  assert.equal(query.get("from"), String(Date.parse("2026-10-23T17:00:00Z")));
  assert.equal(query.get("to"), String(Date.parse("2026-10-25T16:59:59.999Z")));
  assert.equal(query.get("granularity"), "month");
});

test("empty bounds are omitted and grouping defaults to day", () => {
  assert.equal(buildRevenueQuery(), "granularity=day");
  assert.equal(buildRevenueQuery({ from: "", to: null }), "granularity=day");
  const query = new URLSearchParams(buildRevenueQuery({ from: "2026-10-24" }));
  assert.equal(query.has("to"), false);
  assert.equal(query.get("granularity"), "day");
  assert.ok(new URLSearchParams(buildRevenueQuery({ to: "2026-10-24" })).has("to"));
});

test("presets have stable order and return independent values", () => {
  assert.deepEqual(revenuePresets(), [{ key: "7d" }, { key: "30d" }, { key: "month" }, { key: "custom" }]);
  const presets = revenuePresets();
  presets[0].key = "changed";
  assert.equal(revenuePresets()[0].key, "7d");
});

test("errors use status and stable codes rather than messages", () => {
  for (const [status, suffix] of [[401, "AuthError"], [403, "AccessError"], [404, "RequestError"], [500, "RequestError"]]) {
    assert.equal(revenueErrorKey({ status }), `adminRevenue${suffix}`);
  }
  assert.equal(revenueErrorKey({ status: 400, body: { code: "PAYMENT_REVENUE_FILTER_INVALID", message: "different language" } }), "adminRevenueFilterError");
  assert.equal(revenueErrorKey(null), "adminRevenueRequestError");
});

test("all revenue keys exist in both languages", () => {
  const keys = Object.keys(translations.en).filter((key) => key.startsWith("adminRevenue"));
  assert.ok(keys.length > 30);
  assert.deepEqual(keys.sort(), Object.keys(translations.vi).filter((key) => key.startsWith("adminRevenue")).sort());
  for (const key of keys) assert.ok(translations.en[key] && translations.vi[key]);
});
