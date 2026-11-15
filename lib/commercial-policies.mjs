/**
 * LX9 prospective merchant commercial terms. No changes to historic orders or ledgers.
 * This module is deliberately side-effect free and usable in node:test.
 */
export const COMMERCIAL_COUNTRIES = ["ZW", "MW"];
export const COMMERCIAL_SERVICES = ["eat", "shop", "book", "events"];
export const BUSINESS_TYPES = ["*", "directory_profile", "restaurant_food", "grocery_essentials", "retail_store", "appointments_services", "accommodation_activities", "ticketing_events"];
export const EMPTY_COMMERCIAL_POLICY = Object.freeze({
  mode: "draft", revision: 0, agreementVersion: "", agreementUrl: "", rules: [],
  trial: { status: "hidden", benefit: "commission", durationMonths: 3, startsAt: "", endsAt: "", approvedAt: "", approvalReference: "", headline: "", termsUrl: "" }
});

function validInstant(value) { const stamp = Date.parse(value || ""); return Number.isFinite(stamp) ? stamp : null; }
function withinWindow(entry, now) {
  const start = validInstant(entry?.startsAt);
  const end = validInstant(entry?.endsAt);
  return (!start || now >= start) && (!end || now < end);
}
function validRate(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100; }
export function commercialRule(config, { country, service, businessType }, now = Date.now()) {
  if (config?.mode !== "active" || !COMMERCIAL_COUNTRIES.includes(country) || !COMMERCIAL_SERVICES.includes(service)) return null;
  const matching = (config.rules || []).filter((entry) => entry.country === country && entry.service === service &&
    ["*", businessType].includes(entry.businessType) && withinWindow(entry, now) && validRate(entry.commissionPercent));
  return matching.find((entry) => entry.businessType === businessType) || matching.find((entry) => entry.businessType === "*") || null;
}
export function publicCommercialTrial(config, now = Date.now()) {
  const trial = config?.trial;
  // This rollout supports only commission waivers; subscription charging is not implemented.
  if (config?.mode !== "active" || trial?.status !== "live" || trial.benefit !== "commission" ||
    !validInstant(trial.approvedAt) || String(trial.approvalReference || "").trim().length < 8 || !validInstant(trial.startsAt) || !validInstant(trial.endsAt) ||
    !withinWindow(trial, now) || trial.durationMonths !== 3 ||
    !/^https:\/\//.test(trial.termsUrl || "") || String(trial.headline || "").trim().length < 15) return null;
  return { headline: trial.headline, benefit: "commission", durationMonths: 3, termsUrl: trial.termsUrl, endsAt: trial.endsAt };
}
export function commercialFingerprint({ revision = 0, overrideRevision = 0, country, service, commissionPercent, agreementVersion = "" }) {
  return [revision, overrideRevision, country, service, Number(commissionPercent).toFixed(3), agreementVersion].join("|");
}
export function commercialOffer({ config, override, country, service, businessType, fallbackPercent, now = Date.now() }) {
  const fallback = validRate(fallbackPercent) ? fallbackPercent : 0;
  const rule = commercialRule(config, { country, service, businessType }, now);
  if (!rule) return { source: "existing", commissionPercent: fallback, enabled: false, agreementRequired: false };
  const approvedOverride = override?.status === "active" && override.country === country &&
    (!override.service || override.service === service) && withinWindow(override, now) && validRate(override.commissionPercent);
  const percent = approvedOverride ? override.commissionPercent : rule.commissionPercent;
  const fingerprint = commercialFingerprint({ revision: config.revision, overrideRevision: approvedOverride ? override.revision : 0,
    country, service, commissionPercent: percent, agreementVersion: config.agreementVersion });
  return { enabled: true, source: approvedOverride ? "business_override" : "country_plan", commissionPercent: percent,
    policyRevision: config.revision, overrideRevision: approvedOverride ? override.revision : 0,
    agreementVersion: config.agreementVersion, contractEndsAt: approvedOverride ? override.endsAt || rule.endsAt || null : rule.endsAt || null, fingerprint, agreementRequired: true };
}
export function effectiveCommercialTerms({ config, override, agreement, country, service, businessType, fallbackPercent, now = Date.now() }) {
  const proposal = commercialOffer({ config, override, country, service, businessType, fallbackPercent, now });
  const approved = Boolean(agreement?.acceptedAt && validInstant(agreement.acceptedAt) &&
    agreement.country === country && agreement.service === service && validRate(agreement.agreedCommissionPercent) &&
    (!validInstant(agreement.contractEndsAt) || now < validInstant(agreement.contractEndsAt)));
  // A new revision does NOT amend already-accepted rates. The merchant must agree
  // to the new terms before anything changes for subsequent orders.
  if (!approved) return { commissionPercent: validRate(fallbackPercent) ? fallbackPercent : 0,
    source: "existing", policyRevision: null, agreementAccepted: false, trialApplied: false };
  const stillCurrent = proposal.enabled && agreement.fingerprint === proposal.fingerprint;
  const trialEnds = validInstant(agreement.trialEndsAt);
  const trialApplied = agreement.trialBenefit === "commission" && validInstant(agreement.trialEnrolledAt) &&
    trialEnds && now < trialEnds;
  return { commissionPercent: trialApplied ? 0 : agreement.agreedCommissionPercent,
    source: stillCurrent ? proposal.source : "prior_accepted_agreement", policyRevision: agreement.policyRevision || null,
    overrideRevision: agreement.overrideRevision || 0, agreementAccepted: true,
    agreementVersion: agreement.agreementVersion, trialApplied: Boolean(trialApplied),
    trialEndAt: trialApplied ? agreement.trialEndsAt : null };
}
