import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { validateRideLabLocations } from "@/lib/ride-lab-validation";

export const runtime = "nodejs";
const point = z.object({
  lat: z.number().finite(), lng: z.number().finite(), country: z.enum(["ZW", "MW"]),
  label: z.string().max(160).optional(), formattedAddress: z.string().max(500).optional(),
  city: z.string().max(100).optional(), area: z.string().max(100).optional(), accuracy: z.number().finite().optional()
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), pickup: point, dropoff: point, serviceType: z.enum(["economy", "comfort", "xl"]).default("economy") }).strict(),
  z.object({ action: z.literal("accept"), rideId: z.string().min(8).max(180) }).strict(),
  z.object({ action: z.literal("advance"), rideId: z.string().min(8).max(180) }).strict(),
  z.object({ action: z.literal("cancel"), rideId: z.string().min(8).max(180) }).strict()
]);
const NEXT = Object.freeze({
  driver_assigned: "driver_to_pickup",
  driver_to_pickup: "driver_arrived_pickup",
  driver_arrived_pickup: "in_trip",
  in_trip: "completed"
});
const END = new Set(["completed", "cancelled"]);

async function invited(db, user) {
  if (!user.email || user.email_verified !== true) throw Object.assign(new Error("A verified invited email is required for Ride Lab."), { status: 403 });
  const access = await db.collection("mobilityRideLab").doc("access").get();
  if (!(access.data()?.testerEmails || []).includes(String(user.email).trim().toLowerCase())) {
    throw Object.assign(new Error("This account has not been invited to Ride Lab."), { status: 403 });
  }
}

function publicTrip(id, data, driverPosition = null) {
  return { id, state: data.state, customerId: data.customerId, driverId: data.driverId || null,
    pickup: data.pickup, dropoff: data.dropoff, serviceType: data.serviceType,
    driverPosition, createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null };
}

export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    await invited(db, user);
    const docs = await db.collection("mobilityRideLabTrips").orderBy("updatedAt", "desc").limit(40).get();
    const rows = docs.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const own = rows.filter((row) => row.customerId === user.uid || row.driverId === user.uid).slice(0, 12);
    const open = rows.filter((row) => row.state === "searching_driver" && row.customerId !== user.uid).slice(0, 12);
    const driverIds = [...new Set(own.map((row) => row.driverId).filter(Boolean))].slice(0, 12);
    const positions = await Promise.all(driverIds.map((id) => db.collection("mobilityRideLabLocations").doc(id).get()));
    const byDriver = Object.fromEntries(driverIds.map((id, index) => [id, positions[index]?.data()?.location || null]));
    return Response.json({ ok: true, simulation: true,
      myTrips: own.map((row) => publicTrip(row.id, row, byDriver[row.driverId] || null)),
      offers: open.map((row) => publicTrip(row.id, row)) },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    await invited(db, user);
    await enforceRateLimit(request, { key: "ride-lab-actions", limit: 15, windowMs: 60000, identity: user.uid });
    const input = schema.parse(await request.json());
    const collection = db.collection("mobilityRideLabTrips");
    const now = FieldValue.serverTimestamp();

    if (input.action === "request") {
      const locationValidation = validateRideLabLocations(input.pickup, input.dropoff);
      if (!locationValidation.ok) {
        throw Object.assign(new Error(locationValidation.error), { status: 400 });
      }
      const doc = collection.doc();
      await doc.create({ customerId: user.uid, driverId: null, state: "searching_driver",
        pickup: input.pickup, dropoff: input.dropoff, serviceType: input.serviceType,
        simulation: true, createdAt: now, updatedAt: now });
      return Response.json({ ok: true, rideId: doc.id, state: "searching_driver", simulation: true });
    }

    const ref = collection.doc(input.rideId);
    let state;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw Object.assign(new Error("This simulated Ride no longer exists."), { status: 404 });
      const data = snap.data();
      if (END.has(data.state)) throw Object.assign(new Error("This simulated Ride is already finished."), { status: 409 });
      if (input.action === "accept") {
        if (data.customerId === user.uid) throw Object.assign(new Error("Use a different invited account as the test Driver."), { status: 403 });
        if (data.state !== "searching_driver" || data.driverId) throw Object.assign(new Error("Another tester already accepted this test request."), { status: 409 });
        state = "driver_assigned";
        transaction.update(ref, { state, driverId: user.uid, acceptedAt: now, updatedAt: now });
      } else if (input.action === "advance") {
        if (data.driverId !== user.uid || !NEXT[data.state]) throw Object.assign(new Error("This test state cannot be advanced by your account."), { status: 403 });
        state = NEXT[data.state];
        transaction.update(ref, { state, updatedAt: now });
      } else if (input.action === "cancel") {
        if (data.customerId !== user.uid && data.driverId !== user.uid) throw Object.assign(new Error("Only the test rider or Driver can cancel."), { status: 403 });
        state = "cancelled";
        transaction.update(ref, { state, updatedAt: now });
      }
    });
    // This endpoint does not write rideTrips, rideOffers, driverPresence,
    // driverEarningsLedger or payments, and never dispatches a real Driver.
    return Response.json({ ok: true, rideId: input.rideId, state, simulation: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Review the test Ride details." }, { status: 400 });
    return apiError(error);
  }
}
