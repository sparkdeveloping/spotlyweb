import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { OPERATION_GRANT_TYPES } from "@/lib/operations-grants";
import { serializeOperationGrant } from "@/lib/operations-grants-server";
import { normalizeCountryCode } from "@/lib/country-engine";
import { normalizeServiceId, serviceAvailabilityCityKey } from "@/lib/service-availability";

export const runtime = "nodejs";

const issueSchema = z.object({
  action: z.literal("issue"),
  userId: z.string().min(3).max(180),
  type: z.enum(OPERATION_GRANT_TYPES),
  services: z.array(z.string()).max(12).default([]),
  countries: z.array(z.string()).max(12).default([]),
  cities: z.array(z.object({ country: z.string(), city: z.string() })).max(30).default([]),
  expiresAt: z.string().datetime(),
  reason: z.string().trim().min(10).max(600)
}).strict();
const revokeSchema = z.object({ action: z.literal("revoke"), grantId: z.string().min(8).max(180), reason: z.string().trim().min(5).max(600) }).strict();
const schema = z.discriminatedUnion("action", [issueSchema, revokeSchema]);

function normalizeScope(input) {
  const services = [...new Set(input.services.map(normalizeServiceId).filter(Boolean))].sort();
  const countries = [...new Set(input.countries.map(normalizeCountryCode).filter(Boolean))].sort();
  const cities = [...new Set(input.cities.map((item) => {
    const country = normalizeCountryCode(item.country);
    return country ? serviceAvailabilityCityKey(country, item.city) : null;
  }).filter(Boolean))].sort();
  return { services, countries, cities };
}

export async function GET(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "admin.access");
    const userId = String(new URL(request.url).searchParams.get("userId") || "").trim();
    if (!userId) return Response.json({ ok: false, error: "Choose an account." }, { status: 400 });
    const { db } = getAdminServices();
    const [userSnap, grantsSnap] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("operationGrants").where("userId", "==", userId).limit(100).get()
    ]);
    if (!userSnap.exists) return Response.json({ ok: false, error: "The account was not found." }, { status: 404 });
    const grants = grantsSnap.docs.map((doc) => serializeOperationGrant(doc.id, doc.data())).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return Response.json({ ok: true, grants }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "admin.access");
    const input = schema.parse(await request.json());
    const { db } = getAdminServices();
    if (input.action === "revoke") {
      const ref = db.collection("operationGrants").doc(input.grantId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw Object.assign(new Error("The Operations grant was not found."), { status: 404 });
        if (snap.data()?.status !== "active") return;
        tx.update(ref, { status: "revoked", revokedAt: FieldValue.serverTimestamp(), revokedBy: actor.uid, revokeReason: input.reason, updatedAt: FieldValue.serverTimestamp() });
        tx.create(db.collection("auditLogs").doc(), { action: "operations_grant.revoked", entityType: "operationGrant", entityId: input.grantId, actorId: actor.uid, actorEmail: actor.email || "", metadata: { userId: snap.data()?.userId || "", type: snap.data()?.type || "", reason: input.reason }, createdAt: FieldValue.serverTimestamp() });
      });
      return Response.json({ ok: true });
    }

    const expiry = new Date(input.expiresAt);
    const now = Date.now();
    if (expiry.getTime() <= now + 5 * 60_000) throw Object.assign(new Error("Operations grants must remain valid for at least five minutes."), { status: 400 });
    if (expiry.getTime() > now + 90 * 24 * 60 * 60_000) throw Object.assign(new Error("Operations grants cannot be issued for more than 90 days."), { status: 400 });
    const userRef = db.collection("users").doc(input.userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw Object.assign(new Error("The account was not found."), { status: 404 });
    const scope = normalizeScope(input);
    if (input.services.length && scope.services.length !== input.services.length) throw Object.assign(new Error("Choose only canonical Spotly services."), { status: 400 });
    if (input.countries.length && scope.countries.length !== input.countries.length) throw Object.assign(new Error("Choose only supported countries."), { status: 400 });
    if (input.cities.length && scope.cities.length !== input.cities.length) throw Object.assign(new Error("Choose canonical cities for Operations grants."), { status: 400 });
    const ref = db.collection("operationGrants").doc();
    const data = { userId: input.userId, type: input.type, status: "active", ...scope, reason: input.reason, createdBy: actor.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(expiry) };
    await db.runTransaction(async (tx) => {
      tx.create(ref, data);
      tx.create(db.collection("auditLogs").doc(), { action: "operations_grant.issued", entityType: "operationGrant", entityId: ref.id, actorId: actor.uid, actorEmail: actor.email || "", metadata: { userId: input.userId, type: input.type, services: scope.services, countries: scope.countries, cities: scope.cities, expiresAt: expiry.toISOString(), reason: input.reason }, createdAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, grant: serializeOperationGrant(ref.id, { ...data, createdAt: new Date(), expiresAt: expiry }) });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the Operations grant details." }, { status: 400 });
    return apiError(error);
  }
}
