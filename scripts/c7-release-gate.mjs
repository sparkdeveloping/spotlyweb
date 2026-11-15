#!/usr/bin/env node
// C7 release decision from independently collected staging/billing evidence.
// Pure and offline: does not query Firebase, read secrets, or change deployments.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const REQUIRED_EVIDENCE = Object.freeze([
  "webProductionBuild", "fullWebTestsReviewed", "firebaseFunctionsChecks",
  "firestoreAndRtdbEmulatorRules", "stagingAppCheckAndAccessControl",
  "customerXcodeBuild", "driverXcodeBuild", "customerRideSendDeviceTracking",
  "driverBackgroundGpsReconnect", "driverOfferParityAndLatency", "marketplaceDiscoveryParity",
  "paymentAndRefundIdempotency", "billingSkuAttribution", "budgetAlertsVerified",
  "backupRestoreVerified", "rollbacksRehearsed"
]);

const NONNEGATIVE = ["platformCostUsd", "firestoreReads", "rtdbDownloadBytes", "activeDriverHours", "completedCustomerOperations", "errorRate", "offerP95Ms", "trackingP95Ms", "windowDays"];

function validMetrics(observation) {
  if (!observation || typeof observation !== "object") return false;
  if (!NONNEGATIVE.every((name) => typeof observation[name] === "number" && Number.isFinite(observation[name]) && observation[name] >= 0)) return false;
  return observation.activeDriverHours > 0 && observation.completedCustomerOperations > 0 && observation.windowDays >= 7 && observation.errorRate <= 1;
}

export function evaluateC7Release(report) {
  const checks = [];
  const add = (name, passed, note) => checks.push({ name, passed: passed === true, note });
  const evidence = report?.evidence || {};
  for (const name of REQUIRED_EVIDENCE) add(`evidence.${name}`, evidence[name] === true, "Must be independently verified; checking a box alone is not proof.");
  add("trafficMixComparable", report?.trafficMixComparable === true, "Compare like-for-like countries, activity, traffic mix and staged application versions.");
  const b = report?.baseline, c = report?.candidate;
  add("validBaselineMetrics", validMetrics(b), "Both cohorts require seven or more days and nonzero denominators.");
  add("validCandidateMetrics", validMetrics(c), "All measures must be finite, nonnegative, same units and from actual monitoring.");
  if (validMetrics(b) && validMetrics(c)) {
    const rate = (obs, numerator, denominator) => obs[numerator] / obs[denominator];
    const readB = rate(b,"firestoreReads","completedCustomerOperations");
    const readC = rate(c,"firestoreReads","completedCustomerOperations");
    const downloadB = rate(b,"rtdbDownloadBytes","activeDriverHours");
    const downloadC = rate(c,"rtdbDownloadBytes","activeDriverHours");
    const costB = rate(b,"platformCostUsd","completedCustomerOperations");
    const costC = rate(c,"platformCostUsd","completedCustomerOperations");
    // No claimed savings without normalized improvement; a 5% noise margin
    // on rates is for safety regression only, not savings certification.
    add("noReadAmplification", readC <= readB * 1.05, `Reads/operation ${readB.toFixed(2)} -> ${readC.toFixed(2)}.`);
    add("noRtdbBandwidthRegression", downloadC <= downloadB * 1.05, `RTDB bytes/driver-hour ${downloadB.toFixed(0)} -> ${downloadC.toFixed(0)}.`);
    add("noTotalCostRegression", costC <= costB * 1.05, `Platform USD/operation ${costB.toFixed(4)} -> ${costC.toFixed(4)} (only meaningful with comparable mix).`);
    add("noErrorRateRegression", c.errorRate <= b.errorRate + 0.005, `Error ratio ${b.errorRate.toFixed(4)} -> ${c.errorRate.toFixed(4)}.`);
    add("noOfferLatencyRegression", c.offerP95Ms <= Math.max(b.offerP95Ms * 1.05, b.offerP95Ms + 250), `Offer p95 ${b.offerP95Ms} -> ${c.offerP95Ms} ms.`);
    add("noTrackingLatencyRegression", c.trackingP95Ms <= Math.max(b.trackingP95Ms * 1.05, b.trackingP95Ms + 250), `Tracking p95 ${b.trackingP95Ms} -> ${c.trackingP95Ms} ms.`);
  }
  return {
    decision: checks.every((item) => item.passed) ? "READY_FOR_MANUAL_REVIEW" : "NO_GO",
    passed: checks.filter((item) => item.passed).length,
    total: checks.length,
    checks,
    caveat: "Offline operator-supplied evidence is not a deployment authorization, billing measurement, or substitute for real CI and staged testing."
  };
}

function main() {
  const arg = process.argv[2];
  if (!arg || arg === "--help") {
    console.log("Usage: node scripts/c7-release-gate.mjs path/to/staging-evidence.json [--json]\nNo evidence = NO_GO. Evidence must come from real CI, device tests, staging and billing exports.");
    process.exitCode = 2;
    return;
  }
  try {
    const input = JSON.parse(readFileSync(resolve(arg), "utf8"));
    const result = evaluateC7Release(input);
    if (process.argv.includes("--json")) console.log(JSON.stringify(result,null,2));
    else {
      console.log(`C7 decision: ${result.decision} (${result.passed}/${result.total} checks)`);
      for (const item of result.checks) console.log(`${item.passed ? "PASS" : "BLOCK"}  ${item.name} — ${item.note}`);
      console.log(result.caveat);
    }
    if (result.decision !== "READY_FOR_MANUAL_REVIEW") process.exitCode = 1;
  } catch (error) {
    console.error(`C7 evidence could not be evaluated: ${error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) main();
