import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateRide, normalizeRidePoint, rideAvailability } from "@/lib/ride-server";

export const runtime = "nodejs";

const point = z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional(), label: z.string().max(160).optional(), formattedAddress: z.string().max(500).optional(), area: z.string().max(120).optional(), city: z.string().max(120).optional() });
const schema = z.object({ pickup: point, dropoff: point, serviceType: z.enum(["economy", "comfort", "xl"]).default("economy") });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request, { optional: true });
    await enforceRateLimit(request, { key: "ride_quote", limit: 35, windowMs: 10 * 60_000, identity: user?.uid });
    const body = schema.parse(await request.json());
    const pickup = normalizeRidePoint(body.pickup); const dropoff = normalizeRidePoint(body.dropoff);
    if (!pickup || !dropoff) throw Object.assign(new Error("Set valid pickup and destination locations."), { status: 400 });
    const { db } = getAdminServices();
    const settingsSnap = await db.collection("platformSettings").doc("global").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    const availability = rideAvailability(settings, pickup);
    if (!availability.enabled) throw Object.assign(new Error(availability.reason), { status: 409 });
    const quote = estimateRide({ pickup, dropoff, serviceType: body.serviceType, settings });
    return Response.json({ ok: true, quote, serviceTypes: availability.config.pricing.serviceTypes, paymentMethods: availability.config.paymentMethods });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup and destination." }, { status: 400 });
    return apiError(error);
  }
}
