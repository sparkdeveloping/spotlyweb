import { FieldValue } from "firebase-admin/firestore";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { continuationProof, normalizeRegistrationKey } from "@/lib/business-registration-policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const idSchema = z.string().regex(/^br_[a-f0-9]{40}$/);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("continue"), registrationId: idSchema, continuationKey: z.string().min(25).max(80) }),
  z.object({ action: z.literal("link_claim"), registrationId: idSchema, claimId: z.string().min(3).max(180) })
]);
const asError = (message, status = 400) => Object.assign(new Error(message), { status });
const equalHash = (a, b) => {
  if (!/^[a-f0-9]{64}$/.test(String(a || "")) || !/^[a-f0-9]{64}$/.test(String(b || ""))) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};
const shortRecord = (doc) => ({
  registrationId: doc.id,
  businessName: doc.data().businessName || "",
  applicantName: doc.data().applicantName || "",
  phone: doc.data().phone || "",
  email: doc.data().email || "",
  city: doc.data().city || "",
  country: doc.data().country || "",
  category: doc.data().category || "",
  roleAtBusiness: doc.data().roleAtBusiness || "owner",
  status: doc.data().status || "new",
  linkedClaimId: doc.data().linkedClaimId || null
});

// A signed-in applicant can recover previously linked leads across devices.
// This is read-only and bounded. Unlinked anonymous leads require their private token.
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!actor?.uid || actor.firebase?.sign_in_provider === "anonymous") throw asError("Sign in to view your registrations.", 401);
    await enforceRateLimit(request, { key: "business-registration-my-leads", identity: actor.uid, limit: 20, windowMs: 60_000 });
    const { db } = getAdminServices();
    const snap = await db.collection("businessRegistrations").where("applicantUid", "==", actor.uid).limit(12).get();
    return Response.json({ ok: true, registrations: snap.docs.map(doc => ({
      registrationId: doc.id, businessName: doc.data()?.businessName || "",
      status: doc.data()?.status || "new", linkedClaimId: doc.data()?.linkedClaimId || null
    })) }, { headers });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    if (!actor?.uid || actor.isAnonymous || actor.firebase?.sign_in_provider === "anonymous") throw asError("Sign in to continue your registration.", 401);
    await enforceRateLimit(request, { key: "business-registration-continuation", identity: actor.uid, limit: 12, windowMs: 60_000 });
    const payload = schema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = db.collection("businessRegistrations").doc(payload.registrationId);
    const result = await db.runTransaction(async (tx) => {
      const registration = await tx.get(ref);
      if (!registration.exists) throw asError("Registration not found. Contact Spotly support.", 404);
      const record = registration.data() || {};
      if (payload.action === "continue") {
        // An opaque token saved by the original submitter proves possession of that request.
        // Email, phone, and business name by themselves are never sufficient.
        const key = normalizeRegistrationKey(payload.continuationKey);
        const proof = continuationProof(key, payload.registrationId);
        if (!equalHash(proof, record.continuationProof)) throw asError("This registration cannot be opened on this device. Contact support.", 403);
        const created = record.createdAt?.toMillis?.() || 0;
        if (!record.applicantUid && (!created || Date.now() - created > 14 * 24 * 60 * 60_000)) {
          throw asError("This continuation has expired. Contact Spotly to resume.", 410);
        }
        if (record.applicantUid && record.applicantUid !== actor.uid) throw asError("This registration is already linked to another account.", 409);
        if (!record.applicantUid) {
          tx.update(ref, { applicantUid: actor.uid, applicantLinkedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
          tx.create(db.collection("auditLogs").doc(), { action: "business_registration.applicant_linked", actorId: actor.uid, entityType: "businessRegistration", entityId: ref.id, createdAt: FieldValue.serverTimestamp() });
        }
        return { ...shortRecord(registration), applicantUid: actor.uid, linkedClaimId: record.linkedClaimId || null };
      }
      // A lead has no approval authority. Link only an already submitted claim owned by this user.
      if (record.applicantUid !== actor.uid) throw asError("Continue this registration before linking a claim.", 403);
      const claimRef = db.collection("businessClaims").doc(payload.claimId);
      const claim = await tx.get(claimRef);
      if (!claim.exists || claim.data()?.applicantId !== actor.uid || !["submitted", "needs_information", "approved"].includes(claim.data()?.status)) {
        throw asError("A verified claim belonging to this account was not found.", 409);
      }
      if (record.linkedClaimId && record.linkedClaimId !== payload.claimId) throw asError("This registration is linked to another claim.", 409);
      if (!record.linkedClaimId) {
        tx.update(ref, { linkedClaimId: payload.claimId, linkedClaimAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        tx.create(db.collection("auditLogs").doc(), { action: "business_registration.claim_linked", actorId: actor.uid, entityType: "businessRegistration", entityId: ref.id, metadata: { claimId: payload.claimId }, createdAt: FieldValue.serverTimestamp() });
      }
      return { registrationId: ref.id, linkedClaimId: payload.claimId };
    });
    return Response.json({ ok: true, ...result }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Check your registration reference." }, { status: 400, headers });
    return apiError(error);
  }
}
