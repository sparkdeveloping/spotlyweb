import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { authenticateRequest, apiError, getAdminServices } from "@/lib/firebase-admin";
import { requireSpotlyStaffPermission } from "@/lib/access-control-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { COMMERCIAL_COUNTRIES, COMMERCIAL_SERVICES } from "@/lib/commercial-policies.mjs";
import { normalizeCountryCode } from "@/lib/country-engine";
import { marketplaceProfile } from "@/lib/marketplace-taxonomy";
export const runtime = "nodejs";

const instant = z.union([z.literal(""), z.string().datetime({ offset: true })]);
const rule = z.object({ id: z.string().regex(/^[a-z0-9_-]{3,70}$/), country: z.enum(COMMERCIAL_COUNTRIES), service: z.enum(COMMERCIAL_SERVICES),
  businessType: z.string().regex(/^[a-z0-9_*]{1,80}$/).default("*"), commissionPercent: z.number().finite().min(0).max(100),
  startsAt: instant.default(""), endsAt: instant.default("") }).strict();
const trial = z.object({ status: z.enum(["hidden", "scheduled", "live"]), benefit: z.literal("commission"), durationMonths: z.literal(3),
  startsAt: instant, endsAt: instant, approvedAt: instant, approvalReference: z.string().trim().max(180), headline: z.string().trim().max(180), termsUrl: z.union([z.literal(""), z.string().url().startsWith("https://")]) }).strict();
const plan = z.object({ mode: z.enum(["draft", "active"]), agreementVersion: z.string().trim().max(60), agreementUrl: z.union([z.literal(""), z.string().url().startsWith("https://")]),
  rules: z.array(rule).max(48), trial }).strict();
const override = z.object({ businessId: z.string().regex(/^[A-Za-z0-9_-]{2,160}$/), status: z.enum(["draft", "active", "disabled"]),
  country: z.enum(COMMERCIAL_COUNTRIES), service: z.enum(COMMERCIAL_SERVICES), commissionPercent: z.number().finite().min(0).max(100),
  startsAt: instant.default(""), endsAt: instant.default(""), reason: z.string().trim().min(12).max(800),
  signedTermsEvidence: z.string().trim().max(240).default("") }).strict();
const input = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("global"), expectedRevision: z.number().int().min(0), plan }).strict(),
  z.object({ scope: z.literal("business"), expectedRevision: z.number().int().min(0), override }).strict()
]);
function verifyWindow(item) {
  if (item.startsAt && item.endsAt && Date.parse(item.startsAt) >= Date.parse(item.endsAt)) throw Object.assign(new Error("The end date must follow the start date."), { status: 422 });
}
function verifyPlan(data) {
  const keys = new Set(), ids = new Set();
  for (const row of data.rules) {
    verifyWindow(row);
    if (ids.has(row.id)) throw Object.assign(new Error("Each commercial rule must have a unique identifier."), { status: 422 });
    ids.add(row.id);
    const key = `${row.country}:${row.service}:${row.businessType}`;
    if (keys.has(key)) throw Object.assign(new Error("Country, service and business type combinations must be unique."), { status: 422 });
    keys.add(key);
  }
  if (data.mode === "active" && (!data.agreementVersion || !data.agreementUrl || !data.rules.length)) throw Object.assign(new Error("Define the signed agreement version and pricing rules before activating."), { status: 422 });
  if (data.trial.status !== "hidden") {
    verifyWindow(data.trial);
    if (!data.trial.startsAt || !data.trial.endsAt || !data.trial.termsUrl || data.trial.headline.length < 15) throw Object.assign(new Error("Trial dates, approved terms link and a clear offer headline are required."), { status: 422 });
  }
  if (data.trial.status === "live" && (data.mode !== "active" || !data.trial.approvedAt || data.trial.approvalReference.length < 8)) throw Object.assign(new Error("The commission trial cannot launch before an approved active policy."), { status: 422 });
}
async function allowed(actor, db) { await requireSpotlyStaffPermission(db, actor, "finance.configure", { roles: ["finance_admin"] }); }
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    const { db } = getAdminServices(); await allowed(actor, db);
    const id = new URL(request.url).searchParams.get("businessId");
    if (id && !/^[A-Za-z0-9_-]{2,160}$/.test(id)) throw Object.assign(new Error("Invalid business reference."), { status: 422 });
    const [settings, merchant] = await Promise.all([db.collection("platformSettings").doc("global").get(), id ? db.collection("businessCommercialOverrides").doc(id).get() : Promise.resolve(null)]);
    return Response.json({ ok: true, plans: settings.data()?.commercialPlans || null, override: merchant?.exists ? merchant.data() : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request) {
  try {
    const actor = await authenticateRequest(request);
    await enforceRateLimit(request, { key: "admin-commercial-plans", identity: actor.uid, limit: 20, windowMs: 3600000 });
    const body = input.parse(await request.json());
    const { db } = getAdminServices(); await allowed(actor, db);
    if (body.scope === "global") verifyPlan(body.plan);
    // Financial activation and launch of a waiver are high impact, require a fresh admin sign-in.
    const activating = body.scope === "global" ? body.plan.mode === "active" || body.plan.trial.status === "live" : body.override.status === "active";
    if (activating && (!actor.auth_time || Math.floor(Date.now() / 1000) - Number(actor.auth_time) > 15 * 60))
      throw Object.assign(new Error("Sign in again before activating commercial terms or an offer."), { status: 401 });
    else { verifyWindow(body.override); if (body.override.status === "active" && !body.override.signedTermsEvidence) throw Object.assign(new Error("Add a verified, non-sensitive signed-terms evidence reference before activating an override."), { status: 422 }); }
    const ref = body.scope === "global" ? db.collection("platformSettings").doc("global") : db.collection("businessCommercialOverrides").doc(body.override.businessId);
    let revision;
    await db.runTransaction(async (tx) => {
      const previous = await tx.get(ref);
      const old = body.scope === "global" ? previous.data()?.commercialPlans : previous.data();
      if (Number(old?.revision || 0) !== body.expectedRevision) throw Object.assign(new Error("These terms changed in another session. Refresh before saving."), { status: 409 });
      revision = body.expectedRevision + 1;
      const next = { ...(body.scope === "global" ? body.plan : body.override), revision,
        updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid };
      if (body.scope === "global") tx.set(ref, { commercialPlans: next }, { merge: true });
      else {
        const business = await tx.get(db.collection("businesses").doc(body.override.businessId));
        if (!business.exists) throw Object.assign(new Error("Business not found."), { status: 404 });
        if (normalizeCountryCode(business.data()?.country) !== body.override.country) throw Object.assign(new Error("Override country does not match the business."), { status: 422 });
        if (marketplaceProfile(business.data()).service !== body.override.service) throw Object.assign(new Error("This override must match the business's current Spotly service."), { status: 422 });
        tx.set(ref, next);
      }
      tx.create(db.collection("auditLogs").doc(), { action: body.scope === "global" ? "commercial_policy.changed" : "commercial_policy.business_override_changed",
        actorId: actor.uid, actorEmail: actor.email || "", entityType: body.scope === "global" ? "platformSettings" : "businessCommercialOverride",
        entityId: body.scope === "global" ? "global" : body.override.businessId,
        metadata: { revision, previousRevision: body.expectedRevision, mode: body.scope === "global" ? body.plan.mode : body.override.status,
          // No PII, signed documents or arbitrary evidence content in the audit event.
          countries: body.scope === "global" ? [...new Set(body.plan.rules.map((item) => item.country))] : [body.override.country] },
        createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, revision }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
