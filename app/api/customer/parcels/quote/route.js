import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateParcel, normalizeParcelPoint, parcelAvailability, parcelQuoteAvailability } from "@/lib/parcel-server";
import {validateSendTerritory} from "@/lib/send-territory";
import {getVerifiedRideRoute} from "@/lib/ride-routing";
import { sendQuoteRequestSchema } from "@/lib/contracts/schemas";
import { requireServiceDiscoverable } from "@/lib/service-availability-server";

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
    const serviceDecision=requireServiceDiscoverable(settings, { service: "send", country: pickup.country, city: pickup.city });
    const quoteAvailability = parcelQuoteAvailability(settings, pickup); if (!quoteAvailability.enabled) throw Object.assign(new Error(quoteAvailability.reason), { status: 409 });
    const availability = parcelAvailability(settings, pickup);
    validateSendTerritory(pickup,dropoff,quoteAvailability.config);
    const route=await getVerifiedRideRoute(pickup,dropoff);
    const bookingAvailable=serviceDecision.transactable&&availability.enabled;
    return Response.json({ ok: true, quote: estimateParcel({ pickup, dropoff, parcelSize: body.parcelSize, settings,route }), serviceAvailability:serviceDecision, bookingAvailable, bookingReason:bookingAvailable?"":(serviceDecision.transactable?availability.reason:(serviceDecision.reason||"Send requests are not live here yet.")), parcelSizes: quoteAvailability.config.pricing.parcelSizes, paymentMethods: availability.config.paymentMethods, scheduledEnabled: availability.config.scheduledEnabled });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup, drop-off and parcel size." }, { status: 400 });
    return apiError(error);
  }
}
