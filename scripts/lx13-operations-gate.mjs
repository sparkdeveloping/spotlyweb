#!/usr/bin/env node
// LX13: offline, read-only operational stop-signal audit. No network, writes or service flags.
// Results are advisory; even all signals passing does not grant production approval.
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import limits from "../contracts/spotly-operations-monitoring.v1.json" with { type: "json" };
import countries from "../contracts/spotly-countries.v1.json" with { type: "json" };
import { evaluateLX12Release } from "./lx12-launch-gate.mjs";

const SHA = /^sha256:[a-f0-9]{64}$/i;
const DAYS = 86_400_000;
const citiesByCountry = new Map(countries.countries.map((country) => [country.code, new Set(country.cities.map((city) => city.name))]));
function integer(value) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function finite(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null; }
function ratio(a, b) { return b > 0 ? a / b : null; }
const round = (value) => value === null ? null : Math.round(value * 1_000_000) / 1_000_000;

export function evaluateLX13Operations(report, { now = Date.now(), lx12 = null } = {}) {
  const blockers = [];
  const stopSignals = [];
  const reviews = [];
  const block = (reason) => blockers.push(reason);
  const observeStop = (reason) => stopSignals.push(reason);
  const candidate = report?.candidate || {};
  if (!SHA.test(String(candidate.buildDigest || "")) || candidate.environment !== "staging" || !Number.isFinite(Date.parse(candidate.frozenAt || ""))) {
    block("Frozen staging candidate, SHA-256 build digest and timestamp required");
  }
  const from = Date.parse(report?.window?.startedAt || ""), to = Date.parse(report?.window?.endedAt || "");
  const frozen = Date.parse(candidate.frozenAt || "");
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(frozen) || from < frozen || from >= to || to > now || now - to > 7 * DAYS || to - from > 7 * DAYS) {
    block("Valid, recent staging observation window after candidate freeze is required");
  }
  const scope = report?.scope || {};
  if (!citiesByCountry.get(scope.country)?.has(scope.city) || !limits.services.includes(scope.service)) block("Country, city and service scope must match the launch contract");
  if (lx12?.assessment !== "READY_FOR_MANUAL_REVIEW" || lx12?.decision !== "NO_GO") block("Valid LX12 evidence must be independently reviewed before release consideration");
  if (lx12?.candidateDigest !== undefined && candidate.buildDigest !== lx12.candidateDigest) block("LX12 and LX13 candidate digests do not match");

  const metrics = report?.metrics || {};
  const attempted = integer(metrics.attempted), completed = integer(metrics.completed), failed = integer(metrics.failed);
  if (attempted === null || completed === null || failed === null || attempted < completed + failed) block("Attempted, completed and failed counts must be nonnegative and consistent");
  if (attempted === 0) reviews.push("No attempted transactions; end-to-end reliability cannot be inferred");
  const failureRate = attempted === null || failed === null ? null : ratio(failed, attempted);
  const successRate = attempted === null || completed === null ? null : ratio(completed, attempted);
  const critical = metrics.critical || {};
  const criticalObserved = {};
  for (const name of limits.criticalCounters) {
    const value = integer(critical[name]);
    criticalObserved[name] = value;
    if (value === null) block(`${name} evidence missing or invalid`);
    else if (value > 0) observeStop(`${name}: ${value} confirmed event(s); stop or isolate affected service and investigate`);
  }
  const thresholds = report?.thresholds || {};
  if (thresholds.approved === true && typeof thresholds.approvedBy === "string" && thresholds.approvedBy.trim() && thresholds.approvedBy !== report?.operator) {
    if (finite(thresholds.maxFailureRate) !== null && thresholds.maxFailureRate <= 1 && failureRate !== null && failureRate > thresholds.maxFailureRate) observeStop("Failure rate exceeds approved threshold");
    if (finite(thresholds.maxFailureRate) === null || thresholds.maxFailureRate > 1) reviews.push("No valid approved failure-rate limit supplied");
  } else reviews.push("No independently approved failure-rate threshold supplied");

  const billing = report?.billing || {};
  const totalCost = finite(billing.totalCost);
  const costCurrency = typeof billing.currency === "string" && /^[A-Z]{3}$/.test(billing.currency) ? billing.currency : null;
  const billingValid = billing.sameWindowVerified === true && billing.sameScopeVerified === true && billing.source === "billing_export" && totalCost !== null && costCurrency !== null;
  const costPerCompleted = billingValid && completed !== null ? ratio(totalCost, completed) : null;
  if (!billingValid) reviews.push("Same-window, same-scope attributed billing export and verified currency are required for unit-cost analysis");
  else if (costPerCompleted === null) reviews.push("No completed transactions; cost per completed transaction is unavailable");
  if (costPerCompleted !== null && thresholds.approved === true && typeof thresholds.approvedBy === "string" && thresholds.approvedBy.trim() && thresholds.approvedBy !== report?.operator && finite(thresholds.maxCostPerCompleted) !== null) {
    if (costPerCompleted > thresholds.maxCostPerCompleted) observeStop("Cost per completed transaction exceeds approved threshold");
  } else reviews.push("No independently approved unit-cost threshold or eligible measurement");
  // Exactly matched windows are necessary but not sufficient; raw provider invoices and
  // settlement/reconciliation evidence must be reviewed by an authorized human.
  if (!/^[a-z][a-z0-9_-]{2,80}$/i.test(String(report?.operator || "")) || !/^[a-z][a-z0-9_-]{2,80}$/i.test(String(report?.reviewer || "")) || report.operator === report.reviewer) {
    block("Independent operator and reviewer identities are required");
  }
  return {
    decision: "NO_GO",
    assessment: blockers.length || stopSignals.length ? "BLOCKED" : "REQUIRES_HUMAN_REVIEW",
    blockers, stopSignals, reviews,
    observed: {
      attempted, completed, failed,
      successRate: round(successRate), failureRate: round(failureRate),
      totalCost: billingValid ? totalCost : null,
      currency: billingValid ? costCurrency : null,
      costPerCompleted: round(costPerCompleted),
      critical: criticalObserved,
    },
    caveat: "This tool does not access live systems or validate raw provider evidence. Never interpret its output as permission to launch, settle, disable, or change a service."
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [opsPath, releasePath] = process.argv.slice(2).filter((value) => !value.startsWith("--"));
  try {
    if (!opsPath || !releasePath || !existsSync(opsPath) || !existsSync(releasePath)) throw new Error("Usage: node scripts/lx13-operations-gate.mjs <staging-operations.json> <lx12-evidence.json> [--json]");
    const report = JSON.parse(readFileSync(opsPath, "utf8"));
    const release = JSON.parse(readFileSync(releasePath, "utf8"));
    const independentGate = evaluateLX12Release(release, { directory: dirname(resolve(releasePath)) });
    const result = evaluateLX13Operations(report, {lx12:{...independentGate, candidateDigest: release.candidate?.buildDigest}});
    if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`LX13 ${result.assessment} · production ${result.decision}`);
      for (const item of result.blockers) console.log(`BLOCK: ${item}`);
      for (const item of result.stopSignals) console.log(`STOP: ${item}`);
      for (const item of result.reviews) console.log(`REVIEW: ${item}`);
      console.log(result.caveat);
    }
    // Successful audit still does NOT approve production.
    if (result.assessment === "BLOCKED") process.exitCode = 1;
  } catch (error) { console.error(`LX13 operational evidence could not be assessed: ${error.message}`); process.exitCode = 2; }
}
