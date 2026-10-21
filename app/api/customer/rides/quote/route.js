import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { estimateRide, normalizeRidePoint, rideAvailability, rideQuoteAvailability } from "@/lib/ride-server";
import {validateRideTerritory} from "@/lib/ride-geography";
import {getVerifiedRideRoute} from "@/lib/ride-routing";

export const runtime = "nodejs";

const point = z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional(), country:z.enum(["ZW","MW"]), label: z.string().max(160).optional(), formattedAddress: z.string().max(500).optional(), area: z.string().max(120).optional(), city: z.string().max(120).optional() });
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
    const quoteReadiness=rideQuoteAvailability(settings,pickup);
    if(!quoteReadiness.enabled)throw Object.assign(new Error(quoteReadiness.reason),{status:409});
    validateRideTerritory(pickup,dropoff,settings.mobility||{});
    const route=await getVerifiedRideRoute(pickup,dropoff);
    const quote=estimateRide({pickup,dropoff,serviceType:body.serviceType,settings,route});
    // A quote is not an authorization to dispatch. Real bookings independently
    // revalidate every launch gate and live payment before accepting requests.
    const booking=rideAvailability(settings,pickup);
    return Response.json({ok:true,quote,
      bookingAvailable:booking.enabled,bookingReason:booking.enabled?"":booking.reason,
      serviceTypes:quoteReadiness.config.pricing.serviceTypes,
      paymentMethods:quoteReadiness.config.paymentMethods},
      {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the pickup and destination." }, { status: 400 });
    return apiError(error);
  }
}
