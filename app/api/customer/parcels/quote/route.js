import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateParcel, normalizeParcelPoint, parcelAvailability } from "@/lib/parcel-server";

export const runtime = "nodejs";
const point = z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional(), label: z.string().max(160).optional(), formattedAddress: z.string().max(500).optional(), area: z.string().max(120).optional(), city: z.string().max(120).optional() });
const schema = z.object({ pickup: point, dropoff: point, parcelSize: z.enum(["small", "medium", "large", "bulky"]).default("medium") });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request, { optional: true });
    await enforceRateLimit(request, { key: "parcel_quote", limit: 35, windowMs: 10 * 60_000, identity: user?.uid });
    const body = schema.parse(await request.json());
    const pickup = normalizeParcelPoint(body.pickup); const dropoff = normalizeParcelPoint(body.dropoff);
    if (!pickup || !dropoff) throw Object.assign(new Error("Set valid pickup and drop-off locations."), { status: 400 });
    const { db } = getAdminServices(); const settingsSnap = await db.collection("platformSettings").doc("global").get(); const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const availability = parcelAvailability(settings, pickup); if (!availability.enabled) throw Object.assign(new Error(availability.reason), { status: 409 });
    return Response.json({ ok: true, quote: estimateParcel({ pickup, dropoff, parcelSize: body.parcelSize, settings }), parcelSizes: availability.config.pricing.parcelSizes, paymentMethods: availability.config.paymentMethods, scheduledEnabled: availability.config.scheduledEnabled });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup, drop-off and parcel size." }, { status: 400 });
    return apiError(error);
  }
}
