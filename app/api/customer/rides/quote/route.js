import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateRide, normalizeRidePoint, rideAvailability, rideQuoteAvailability } from "@/lib/ride-server";
import {validateRideTerritory} from "@/lib/ride-geography";
import {getVerifiedRideRoute} from "@/lib/ride-routing";
import { rideQuoteRequestSchema } from "@/lib/contracts/schemas";
import { requireServiceDiscoverable } from "@/lib/service-availability-server";

export const runtime = "nodejs";

const schema = rideQuoteRequestSchema;

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
    const serviceDecision=requireServiceDiscoverable(settings, { service: "ride", country: pickup.country, city: pickup.city });
    const quoteReadiness=rideQuoteAvailability(settings,pickup);
    if(!quoteReadiness.enabled)throw Object.assign(new Error(quoteReadiness.reason),{status:409});
    validateRideTerritory(pickup,dropoff,settings.mobility||{});
    const route=await getVerifiedRideRoute(pickup,dropoff);
    const quote=estimateRide({pickup,dropoff,serviceType:body.serviceType,settings,route});
    // A quote is not an authorization to dispatch. Real bookings independently
    // revalidate every launch gate and live payment before accepting requests.
    const booking=rideAvailability(settings,pickup);
    const bookingAvailable=serviceDecision.transactable&&booking.enabled;
    return Response.json({ok:true,quote,serviceAvailability:serviceDecision,
      bookingAvailable,bookingReason:bookingAvailable?"":(serviceDecision.transactable?booking.reason:(serviceDecision.reason||"Ride requests are not live here yet.")),
      serviceTypes:quoteReadiness.config.pricing.serviceTypes,
      paymentMethods:quoteReadiness.config.paymentMethods},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup and destination." }, { status: 400 });
    return apiError(error);
  }
}
