import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest, apiError, getAdminServices } from "@/lib/firebase-admin";
import { requireBusinessPermission } from "@/lib/access-control-server";
import { marketplaceProfile } from "@/lib/marketplace-taxonomy";
import { normalizeCountryCode } from "@/lib/country-engine";
import { commercialOffer, effectiveCommercialTerms, publicCommercialTrial } from "@/lib/commercial-policies.mjs";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime = "nodejs";
const ACCEPTING_ROLES = ["organization_owner", "business_owner"];
const READ_ROLES = [...ACCEPTING_ROLES, "business_manager", "finance_manager", "finance_viewer"];
const schema = z.object({ businessId: z.string().regex(/^[A-Za-z0-9_-]{2,160}$/), fingerprint: z.string().min(6).max(230) }).strict();
function contextFor(business = {}, legacyFinance = {}, finance = {}, global = {}) {
  const service = marketplaceProfile(business).service;
  const country = normalizeCountryCode(business.country);
  const merged = { ...legacyFinance, ...finance };
  return { country, service, businessType: business.businessType || "directory_profile",
    fallbackPercent: Number(merged.commissionPercent ?? global.commerce?.commissionPercent ?? global.commerce?.defaultCommissionPercent ?? 0) };
}
async function evidence(db, businessId) {
  const [business, settings, finance, legacy, override, agreement] = await Promise.all([
    db.collection("businesses").doc(businessId).get(), db.collection("platformSettings").doc("global").get(),
    db.collection("businessFinance").doc(businessId).get(), db.collection("businessFinanceSettings").doc(businessId).get(),
    db.collection("businessCommercialOverrides").doc(businessId).get(), db.collection("businessCommercialAgreements").doc(businessId).get()
  ]);
  if (!business.exists) throw Object.assign(new Error("This business could not be found."), { status: 404 });
  const global = settings.data() || {};
  const context = contextFor(business.data(), legacy.data() || {}, finance.data() || {}, global);
  const config = global.commercialPlans || {};
  const proposal = commercialOffer({ config, override: override.data(), ...context });
  const enabledAtRuntime = process.env.SPOTLY_COMMERCIAL_PRICING_ENABLED === "true";
  const current = effectiveCommercialTerms({ config: enabledAtRuntime ? config : null,
    override: enabledAtRuntime ? override.data() : null,
    agreement: enabledAtRuntime ? agreement.data() : null, ...context });
  return { config, proposal, current, agreement: agreement.data() || null, context };
}
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    const businessId = new URL(request.url).searchParams.get("businessId") || "";
    if (!/^[A-Za-z0-9_-]{2,160}$/.test(businessId)) throw Object.assign(new Error("Choose a valid business."), { status: 422 });
    const { db } = getAdminServices();
    const access = await requireBusinessPermission(db, actor, businessId, "finance.read", { allowRoles: READ_ROLES });
    const { config, proposal, current, agreement, context } = await evidence(db, businessId);
    return Response.json({ ok: true, country: context.country, service: context.service,
      existingPercent: context.fallbackPercent, proposed: proposal.enabled ? { commissionPercent: proposal.commissionPercent, source: proposal.source,
        fingerprint: proposal.fingerprint, agreementVersion: proposal.agreementVersion, policyRevision: proposal.policyRevision,
        agreementUrl: config.agreementUrl || "" } : null,
      accepted: Boolean(agreement?.acceptedAt), activationPending: Boolean(agreement?.acceptedAt && process.env.SPOTLY_COMMERCIAL_PRICING_ENABLED !== "true"), proposalAccepted: Boolean(proposal.enabled && agreement?.fingerprint === proposal.fingerprint), canAccept: !access.platformAdmin && ACCEPTING_ROLES.includes(access.membership?.role), activePercent: current.commissionPercent, activeSource: current.source,
      acceptedAt: agreement?.acceptedAt || null, trial: current.agreementAccepted ? publicCommercialTrial(config) : null },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "business-commercial-acceptance", identity: actor.uid, limit: 8, windowMs: 3600000 });
    const input = schema.parse(await request.json());
    const { db } = getAdminServices();
    const access = await requireBusinessPermission(db, actor, input.businessId, "finance.configure", { allowRoles: ACCEPTING_ROLES });
    if (access.platformAdmin || !ACCEPTING_ROLES.includes(access.membership?.role)) throw Object.assign(new Error("Only a verified business owner can accept new commercial terms."), { status: 403 });
    const agreementRef = db.collection("businessCommercialAgreements").doc(input.businessId);
    const historyRef = db.collection("businessCommercialAgreementVersions").doc();
    let result;
    await db.runTransaction(async (tx) => {
      const refs = [db.collection("businesses").doc(input.businessId), db.collection("platformSettings").doc("global"),
        db.collection("businessFinance").doc(input.businessId), db.collection("businessFinanceSettings").doc(input.businessId),
        db.collection("businessCommercialOverrides").doc(input.businessId), agreementRef];
      const [business, settings, finance, legacy, override, prior] = await Promise.all(refs.map((ref) => tx.get(ref)));
      if (!business.exists) throw Object.assign(new Error("This business is no longer available."), { status: 409 });
      if (access.directOwner && !Array.isArray(business.data().ownerIds)) throw Object.assign(new Error("Business ownership needs to be refreshed."), { status: 409 });
      if (access.directOwner && !business.data().ownerIds.includes(actor.uid)) throw Object.assign(new Error("Business ownership changed. Please sign in again."), { status: 409 });
      const global = settings.data() || {};
      const config = global.commercialPlans || {};
      const proposal = commercialOffer({ config, override: override.data(),
        ...contextFor(business.data(), legacy.data() || {}, finance.data() || {}, global) });
      if (!proposal.enabled || !config.agreementUrl || proposal.fingerprint !== input.fingerprint) throw Object.assign(new Error("These terms changed. Review the latest agreement before accepting."), { status: 409 });
      if (prior.data()?.fingerprint === proposal.fingerprint) { result = { accepted: true, alreadyAccepted: true }; return; }
      const acceptedAt = new Date().toISOString();
      const trial = process.env.SPOTLY_COMMERCIAL_PRICING_ENABLED === "true" ? publicCommercialTrial(config) : null;
      const acceptanceRecord = { businessId: input.businessId, fingerprint: proposal.fingerprint, policyRevision: proposal.policyRevision,
        overrideRevision: proposal.overrideRevision, agreementVersion: proposal.agreementVersion, agreementUrl: config.agreementUrl,
        country: normalizeCountryCode(business.data().country), service: marketplaceProfile(business.data()).service,
        agreedCommissionPercent: proposal.commissionPercent, contractEndsAt: proposal.contractEndsAt || null, acceptedBy: actor.uid,
        acceptedAt, ...(trial ? { trialBenefit: "commission", trialEnrolledAt: acceptedAt, trialEndsAt: new Date(new Date(acceptedAt).setUTCMonth(new Date(acceptedAt).getUTCMonth() + 3)).toISOString() } : { trialBenefit: null, trialEnrolledAt: null, trialEndsAt: null }),
        updatedAt: FieldValue.serverTimestamp() };
      tx.set(agreementRef, acceptanceRecord);
      tx.create(historyRef, { ...acceptanceRecord, historyId: historyRef.id });
      tx.create(db.collection("auditLogs").doc(), { action: "commercial_policy.accepted", entityType: "businessCommercialAgreement", entityId: input.businessId,
        actorId: actor.uid, metadata: { revision: proposal.policyRevision, overrideRevision: proposal.overrideRevision,
          country: business.data().country, service: marketplaceProfile(business.data()).service }, createdAt: FieldValue.serverTimestamp() });
      result = { accepted: true, alreadyAccepted: false };
    });
    return Response.json({ ok: true, ...result });
  } catch (error) { return apiError(error); }
}
