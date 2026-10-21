import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { insideCountryBounds } from "@/lib/ride-geography";

export const runtime = "nodejs";
const schema = z.object({
  country: z.enum(["ZW", "MW"]),
  location: z.object({ lat: z.number().finite(), lng: z.number().finite() }).strict()
}).strict();

async function authorizedLab(db, user) {
  if (!user.email || user.email_verified !== true) throw Object.assign(new Error("Verify your account email before using Ride Lab."), { status: 403 });
  const config = await db.collection("mobilityRideLab").doc("access").get();
  const emails = config.data()?.testerEmails || [];
  if (!emails.includes(String(user.email).trim().toLowerCase())) throw Object.assign(new Error("This account has not been invited to Ride Lab."), { status: 403 });
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const config = await db.collection("mobilityRideLab").doc("access").get();
    const allowed = user.email_verified === true &&
      (config.data()?.testerEmails || []).includes(String(user.email || "").toLowerCase());
    if (!allowed) return Response.json({ ok: true, allowed: false });
    const snap = await db.collection("mobilityRideLabLocations").doc(user.uid).get();
    const latest = snap.data();
    return Response.json({ ok: true, allowed: true, position: latest?.location || null,
      country: latest?.country || "ZW", updatedAt: latest?.updatedAt?.toDate?.()?.toISOString() || null });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    await authorizedLab(db, user);
    await enforceRateLimit(request, { key: "ride-lab-location", limit: 12, windowMs: 60000, identity: user.uid });
    const input = schema.parse(await request.json());
    if (!insideCountryBounds(input.location, input.country)) throw Object.assign(new Error("Choose a point within the selected country."), { status: 400 });
    // Deliberately NEVER writes driverPresence, rideTrips, driverOffers or actual GPS.
    // This is a shadow test position for interactive demonstrations only.
    await db.collection("mobilityRideLabLocations").doc(user.uid).set({
      driverId: user.uid, country: input.country, location: input.location,
      source: "simulated_ride_lab", updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return Response.json({ ok: true, position: input.location, simulation: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Choose a valid test location." }, { status: 400 });
    return apiError(error);
  }
}