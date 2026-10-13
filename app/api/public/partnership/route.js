import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { safeText } from "@/lib/server-helpers";

export const runtime = "nodejs";

const schema = z.object({
  organization: z.string().trim().min(2).max(180),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  type: z.string().trim().max(80).optional().default("general"),
  message: z.string().trim().min(10).max(2000)
});

export async function POST(request) {
  try {
    await verifyAppCheckRequest(request);
    const rate = await enforceRateLimit(request, { key: "public-partnership", limit: 5, windowMs: 30 * 60_000 });
    const values = schema.parse(await request.json());
    const { db } = getAdminServices();
    const ref = await db.collection("partnershipLeads").add({
      organization: safeText(values.organization, 180),
      name: safeText(values.name, 120),
      email: values.email.toLowerCase(),
      type: values.type,
      message: safeText(values.message, 2000),
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return Response.json({ ok: true, id: ref.id }, { headers: { "Cache-Control": "no-store", "X-RateLimit-Remaining": String(rate.remaining) } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the partnership details.", details: error.flatten() }, { status: 400 });
    return apiError(error);
  }
}
