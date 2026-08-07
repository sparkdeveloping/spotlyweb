import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  city: z.string().trim().min(1).max(120),
  area: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  interests: z.array(z.string().trim().max(80)).max(12).optional().default([]),
  locale: z.string().trim().max(10).optional().default("en"),
  consent: z.literal(true),
  source: z.string().trim().max(80).optional().default("coming_soon")
});

function waitlistId(email) {
  return createHash("sha256").update(email).digest("hex").slice(0, 40);
}

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    const rate = await enforceRateLimit(request, { key: "public-waitlist", limit: 8, windowMs: 15 * 60_000 });
    const values = schema.parse(await request.json());
    const email = values.email.toLowerCase();
    const id = waitlistId(email);
    const { db } = getAdminServices();
    const ref = db.collection("waitlistEntries").doc(id);
    let alreadyJoined = false;

    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      alreadyJoined = existing.exists;
      const payload = {
        name: safeText(values.name, 120),
        email,
        city: safeText(values.city, 120),
        area: safeText(values.area, 160),
        phone: safeText(values.phone, 40),
        interests: values.interests.map((item) => safeText(item, 80)),
        locale: values.locale,
        consent: true,
        source: values.source,
        country: "ZW",
        status: existing.data()?.status || "waiting",
        updatedAt: FieldValue.serverTimestamp()
      };
      if (!existing.exists) payload.createdAt = FieldValue.serverTimestamp();
      transaction.set(ref, payload, { merge: true });
    });

    return Response.json({ ok: true, id, alreadyJoined }, {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review your launch-list details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
