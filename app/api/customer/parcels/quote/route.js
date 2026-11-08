import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateParcel, normalizeParcelPoint, parcelAvailability } from "@/lib/parcel-server";
import {validateSendTerritory} from "@/lib/send-territory";
import {getVerifiedRideRoute} from "@/lib/ride-routing";
import { sendQuoteRequestSchema } from "@/lib/contracts/schemas";

export const runtime = "nodejs";
const schema = sendQuoteRequestSchema;

export async function POST(request) {
  try {
    const user = await authenticateRequest(request, { optional: true });
    await enforceRateLimit(request, { key: "parcel_quote", limit: 35, windowMs: 10 * 60_000, identity: user?.uid });
    const body = schema.parse(await request.json());
    const pickup = normalizeParcelPoint(body.pickup); const dropoff = normalizeParcelPoint(body.dropoff);
    if (!pickup || !dropoff) throw Object.assign(new Error("Set valid pickup and drop-off locations."), { status: 400 });
    const { db } = getAdminServices(); const settingsSnap = await db.collection("platformSettings").doc("global").get(); const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const availability = parcelAvailability(settings, pickup); if (!availability.enabled) throw Object.assign(new Error(availability.reason), { status: 409 });
    validateSendTerritory(pickup,dropoff,availability.config);
    const route=await getVerifiedRideRoute(pickup,dropoff);
    return Response.json({ ok: true, quote: estimateParcel({ pickup, dropoff, parcelSize: body.parcelSize, settings,route }), parcelSizes: availability.config.pricing.parcelSizes, paymentMethods: availability.config.paymentMethods, scheduledEnabled: availability.config.scheduledEnabled });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup, drop-off and parcel size." }, { status: 400 });
    return apiError(error);
  }
}
