import { createHash, randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";
import { FIRST_ACCESS_INTERESTS, normalizeAttribution } from "@/lib/first-access";
import { acquisitionRollup } from "@/lib/first-access-server";

export const runtime = "nodejs";
const interests = new Set(FIRST_ACCESS_INTERESTS.map(([id]) => id));
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  city: z.string().trim().max(120).optional().default(""),
  area: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  interests: z.array(z.string().trim().max(80)).max(12).optional().default([]),
  priorityInterest: z.string().trim().max(80).optional().default(""),
  timeframe: z.enum(["asap", "this_month", "exploring", ""]).optional().default(""),
  audience: z.enum(["customer", "business", "driver", ""]).optional().default("customer"),
  locale: z.string().trim().max(10).optional().default("en"),
  consent: z.literal(true),
  marketingOptIn: z.boolean().optional().default(false),
  source: z.string().trim().max(80).optional().default("first_access"),
  attribution: z.record(z.string(), z.string().max(300)).optional().default({}),
  firstAttribution: z.record(z.string(), z.string().max(300)).optional().default({})
});
function waitlistId(email) { return createHash("sha256").update(email).digest("hex").slice(0, 40); }

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    const values = schema.parse(await request.json());
    const email = values.email.toLowerCase();
    // If this request represents a pre-created account, never accept a caller-supplied UID.
    // A matching, verified Firebase ID token is the only source of account ownership.
    const actor = request.headers.get("authorization") ? await authenticateRequest(request) : null;
    if (actor && actor.email?.toLowerCase() !== email) {
      return Response.json({ ok: false, error: "The launch email must match the signed-in Spotly account." }, { status: 403 });
    }
    const rate = await enforceRateLimit(request, { key: "public-waitlist", limit: 8, windowMs: 15 * 60_000, identity: actor?.uid || undefined });
    const id = waitlistId(email);
    const { db } = getAdminServices();
    const ref = db.collection("waitlistEntries").doc(id);
    if (values.source === "first_access" && !actor) return Response.json({ ok: false, error: "Sign in to create First Access." }, { status: 401 });
    const attribution = normalizeAttribution(values.attribution);
    const firstAttribution = normalizeAttribution(Object.keys(values.firstAttribution).length ? values.firstAttribution : values.attribution);
    const normalizedInterests = [...new Set(values.interests)].filter((item) => interests.has(item) || ["groceries", "food", "services", "events"].includes(item));
    let alreadyJoined = false;
    let inviteCode = "";
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      alreadyJoined = existing.exists;
      const old = existing.data() || {};
      if (old.accountUid && (!actor || old.accountUid !== actor.uid)) throw Object.assign(new Error("Sign in with the linked account to update this registration."), { status: 403 });
      inviteCode = old.inviteCode || randomBytes(7).toString("hex");
      const payload = {
        name: safeText(values.name, 120), email,
        city: safeText(values.city, 120), area: safeText(values.area, 160), phone: safeText(values.phone, 40),
        interests: normalizedInterests,
        priorityInterest: interests.has(values.priorityInterest) ? values.priorityInterest : "",
        timeframe: values.timeframe, audience: values.audience, locale: values.locale,
        consent: true, marketingOptIn: values.marketingOptIn,
        source: old.source || values.source,
        firstAttribution: old.firstAttribution || firstAttribution,
        lastAttribution: attribution,
        channel: old.channel || attribution.channel,
        campaign: old.campaign || attribution.utm_campaign,
        referralCode: old.referralCode || attribution.via,
        country: "ZW", status: old.status || "new", pipelineNote: old.pipelineNote || "",
        accountUid: actor?.uid || old.accountUid || null,
        accountCreated: Boolean(actor?.uid || old.accountUid),
        inviteCode,
        updatedAt: FieldValue.serverTimestamp()
      };
      if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();
      transaction.set(ref, payload, { merge: true });
    });
    if (!alreadyJoined) {
      // Metrics are noncritical; the successful registration must survive reporting failures.
      await acquisitionRollup(db, "registration", attribution, { interests: normalizedInterests, city: values.city, timeframe: values.timeframe, audience: values.audience }).catch(() => null);
    }
    return Response.json({ ok: true, id, inviteCode, alreadyJoined, accountLinked: Boolean(actor) }, {
      headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(rate.remaining) }
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review your First Access details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
