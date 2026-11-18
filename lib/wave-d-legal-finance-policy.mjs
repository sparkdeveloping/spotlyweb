/** Wave D U13: read-only, bounded country/terms/financial launch review.
 * Settings flags and policy text are not legal authorization or proof of payment.
 * This module is intentionally NEVER used to compute actual charges or dispatch.
 */
import { countryLaunchReadiness, LX6_COUNTRIES, LX6_SERVICES } from "./lx6-country-launch-readiness.mjs";
import { COMMERCIAL_SERVICES, publicCommercialTrial } from "./commercial-policies.mjs";

const HTTPS = /^https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i;
const present = value => typeof value === "string" && value.trim().length > 0;
const review = (id, label, state, detail) => ({ id, label, state, detail });

/** The full live service matrix is the LX12 scope contract; these 3 scopes are
 * the only country/legal evidence types supported by LX6. Never extrapolate to
 * Bite/Shopper/Book/Live or to another jurisdiction. */
export function waveDLegalFinanceReview(settings = {}, now = Date.now()) {
  const scoped = LX6_COUNTRIES.flatMap(country => LX6_SERVICES.map(service => countryLaunchReadiness(settings, country, service, now)));
  const legal = settings?.legal || {};
  const plans = settings?.commercialPlans || {};
  const active = plans.mode === "active";
  const rules = Array.isArray(plans.rules) ? plans.rules : [];
  const knownPairs = new Set();
  let scopedRulesValid = true;
  for (const rule of rules) {
    const key = `${rule?.country || ""}:${rule?.service || ""}:${rule?.businessType || ""}`;
    if (!LX6_COUNTRIES.includes(rule?.country) || !COMMERCIAL_SERVICES.includes(rule?.service) ||
        typeof rule?.commissionPercent !== "number" || !Number.isFinite(rule.commissionPercent) ||
        rule.commissionPercent < 0 || rule.commissionPercent > 100 || knownPairs.has(key)) scopedRulesValid = false;
    knownPairs.add(key);
  }
  const agreementVersioned = present(plans.agreementVersion) && /^[A-Za-z0-9._-]{4,90}$/.test(plans.agreementVersion) &&
    Number.isSafeInteger(plans.revision) && plans.revision > 0 && HTTPS.test(plans.agreementUrl || "");
  const pricingConfigured = active && agreementVersioned && scopedRulesValid && rules.length > 0;
  const trialRequested = plans?.trial?.status === "live";
  const trialApprovedByPolicy = !trialRequested || Boolean(publicCommercialTrial(plans, now));
  const policyUrlsReady = [legal.privacyPolicyUrl, legal.termsUrl, legal.refundPolicyUrl]
    .every(value => HTTPS.test(value || ""));
  const checks = [
    review("wave-d-finance-pricing", "Versioned prospective commission policy", !active ? "not_configured" : pricingConfigured ? "needs_verification" : "blocked",
      !active ? "New commission plans are not active in settings; legacy terms and actual charges still need reconciliation." :
      pricingConfigured ? "A versioned policy with bounded rates exists. Verify each actual merchant acceptance and that no rate changed retroactively." :
      "Active pricing must have a revision, HTTPS agreement, agreement version, and country/service-scoped nonduplicate rates."),
    review("wave-d-trial", "Approved three-month commission trial", trialApprovedByPolicy ? (trialRequested ? "needs_verification" : "not_configured") : "blocked",
      !trialRequested ? "No live commercial trial is configured; never advertise or assume a free trial." :
      trialApprovedByPolicy ? "The policy structure is valid; confirm the approved start, end, enrolment and legal wording against real accounts." :
      "A live trial requires the approved commission-only policy, exact three-month duration, approval reference, dates and HTTPS terms."),
    review("wave-d-policy-links", "Published privacy, terms and refunds", policyUrlsReady ? "needs_verification" : "blocked",
      policyUrlsReady ? "Policy URLs exist. Independently verify actual text, jurisdiction, version, consent and the cancellation journey." :
      "Final HTTPS privacy, terms and refund/cancellation policy URLs must be configured and independently reviewed."),
    review("wave-d-finance-reconciliation", "Transactions, ledger, refunds and payouts", "needs_verification",
      "Settings cannot prove money moved correctly. Independently reconcile payment provider, customer balance, merchant ledger, driver earnings, refunds and payout settlement on staging."),
    review("wave-d-country-approvals", "Zimbabwe and Malawi approvals by service", scoped.every(item => item.ready) ? "needs_verification" : "blocked",
      scoped.every(item => item.ready) ? "Approval metadata exists for Ride, Send and Business in both countries; verify legal authenticity and every city/service activation separately." :
      "Missing or expired country/service evidence. Never treat a Zimbabwe approval as Malawi approval or Ride as Send."),
  ];
  return { checks, scoped, productionDecision: "NO_GO", evidenceScope: "settings_metadata_only" };
}
