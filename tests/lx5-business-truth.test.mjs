import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const insights = readFileSync(resolve(root, "components/business/insights.js"), "utf8");
const repo = readFileSync(resolve(root, "../../business/spotlybusiness/spotlybusiness/Models/FirebaseRepositoryAdapters.swift"), "utf8");
const nativeView = readFileSync(resolve(root, "../../business/spotlybusiness/spotlybusiness/Features/Insights/InsightsView.swift"), "utf8");
const nativeState = readFileSync(resolve(root, "../../business/spotlybusiness/spotlybusiness/App/BusinessAppState.swift"), "utf8");

function extractFunction(name) {
  const start = insights.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} present`);
  const body = insights.slice(start).match(/^function [\s\S]+?^\}/m);
  assert.ok(body, `${name} complete`);
  return body[0];
}

test("date filter is driven by a real clock, not a missing parameter", () => {
  const context = vm.createContext({ Date, Number });
  vm.runInContext(`${extractFunction("toDate")}\n${extractFunction("withinDays")}`, context);
  const now = new Date("2026-11-15T12:00:00Z").getTime();
  const fiveDaysAgo = { createdAt: "2026-11-10T12:00:00Z" };
  assert.equal(context.withinDays(fiveDaysAgo, "7", now), true);
  assert.equal(context.withinDays(fiveDaysAgo, "30", now), true);
  assert.equal(context.withinDays(fiveDaysAgo, "2", now), false);
  assert.equal(context.withinDays(fiveDaysAgo, "all", now), true);
  assert.match(insights, /orders\.filter\(\(record\) => withinDays\(record, range, nowMs\)\)/);
});

test("web refuses truncated, loading or failed operational snapshots", () => {
  assert.match(insights, /ordersLoading \|\| contextSwitching \|\| !nowMs \|\| ordersError \|\| orders\.length >= 500/);
  assert.match(insights, /A complete report is needed/);
  assert.match(insights, /partial totals as complete sales reports/);
});

test("web never sums different currencies into a single monetary card", () => {
  assert.match(insights, /recordedCurrencies\.size === 1/);
  assert.match(insights, /Number\.isFinite\(amount\) && amount >= 0/);
  assert.match(insights, /valuesVerified \? formatCurrency\(revenue, currency\) : "—"/);
});

test("full refunds are excluded from completed gross value and pending refunds block totals", () => {
  assert.match(insights, /completedNotRefunded = completed\.filter/);
  assert.match(insights, /\["refund_pending", "chargeback", "chargeback_pending"\]/);
  assert.match(nativeView, /Excludes fully refunded activity/);
});

test("business native shows no invented fixed trends or multiplied customers", () => {
  assert.doesNotMatch(nativeView, /Label\("12%"/);
  assert.doesNotMatch(nativeView, /trend:\s*0\.04/);
  assert.doesNotMatch(nativeView, /customersToday \* \(selectedPeriod \+ 1\)/);
  assert.match(nativeView, /periodSummaries\[periodKey\]/);
});

test("native reporting is fail-closed at query cap and scoped to business and branch", () => {
  assert.match(repo, /whereField\("businessId", isEqualTo: scope\.businessID\)/);
  assert.match(repo, /whereField\("branchId", isEqualTo: locationID\)/);
  assert.match(repo, /query\.limit\(to: 1001\)/);
  assert.match(repo, /snapshot\.count <= 1000/);
});

test("native activity load is protected from stale branch and account responses", () => {
  assert.match(nativeState, /secondaryDataGeneration == requestGeneration/);
  assert.match(nativeState, /activeBusiness\.selectedLocationID == originalLocationID/);
  assert.match(nativeState, /analyticsLoadState = canViewAnalytics \? \.unavailable : \.notLoaded/);
  assert.match(nativeState, /Task \{ await loadProductionSecondaryData\(\) \}/);
  assert.match(nativeState, /let canViewRevenue = can\(\.viewRevenue\)/);
  assert.match(nativeState, /let canViewAnalytics = can\(\.viewAnalytics\)/);
  assert.match(nativeState, /let canViewMoney = canViewRevenue \|\| can\(\.viewPayouts\)/);
});

test("production does not substitute debug fixtures when analytics fails", () => {
  assert.match(nativeState, /if canViewAnalytics, let verified = loadedAnalytics \{[\s\S]*?analyticsLoadState = \.ready[\s\S]*?else \{[\s\S]*?analytics = \.empty[\s\S]*?analyticsLoadState = canViewAnalytics \? \.unavailable : \.notLoaded/);
});

test("money screens reject stale account snapshots and provide retry instead of endless spinner", () => {
  const moneyUI = readFileSync(resolve(root, "../../business/spotlybusiness/spotlybusiness/Features/Profile/FinanceViews.swift"), "utf8");
  assert.match(nativeState, /let verified = try await api\.money\(businessID: businessID\)/);
  assert.match(nativeState, /guard workspaceGeneration == generation, activeBusiness\.id == businessID/);
  assert.match(nativeState, /moneyLoadError = "Money information could not be verified/);
  assert.match(moneyUI, /else if let message = appState\.moneyLoadError/);
  assert.match(moneyUI, /Button\("Try again"\)/);
  assert.doesNotMatch(moneyUI, /Zimbabwean bank account/);
});

test("native Firestore report rejects missing currency and nonfinite totals", () => {
  assert.match(repo, /let recordedCurrency = FirebaseDTOMapper\.string/);
  assert.match(repo, /!recordedCurrency\.isEmpty, let amount, amount\.doubleValue\.isFinite, amount\.doubleValue >= 0/);
  assert.match(repo, /"refund_pending", "chargeback", "chargeback_pending"/);
  assert.match(repo, /throw AppError\.server\("This activity report needs verification/);
});
