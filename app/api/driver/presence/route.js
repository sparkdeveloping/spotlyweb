import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { operationalEligibility, normalizeLocation } from "@/lib/driver-delivery-server";

export const runtime = "nodejs";
const schema = z.object({ online: z.boolean(), location: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }).optional() });

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const presenceRef = db.collection("driverPresence").doc(user.uid);
    const [driverSnap, vehicleQuery, documentQuery, presenceSnap] = await Promise.all([
      db.collection("drivers").doc(user.uid).get(),
      db.collection("driverVehicles").where("driverId", "==", user.uid).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", user.uid).limit(50).get(),
      presenceRef.get()
    ]);
    const driver = driverSnap.exists ? driverSnap.data() : null;
    if (!driver) throw Object.assign(new Error("Your Driver application is not approved yet."), { status: 403 });
    const vehicles = vehicleQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const documents = documentQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const current = presenceSnap.exists ? presenceSnap.data() : null;
    const eligibility = operationalEligibility({ driver, vehicle: vehicles.find((item) => item.status === "approved") || vehicles[0], documents, presence: current });
    if (!body.online && current?.currentJobId) throw Object.assign(new Error("Finish your active delivery before going offline."), { status: 409 });
    if (body.online && !eligibility.eligible) {
      return Response.json({ ok: false, error: "You cannot go online yet.", blockers: eligibility.checks.filter((item) => !item.ok), eligibility }, { status: 409 });
    }
    const location = body.location ? normalizeLocation(body.location) : null;
    if (body.online && !location) throw Object.assign(new Error("Turn on location to receive nearby deliveries."), { status: 409 });
    await presenceRef.set({
      driverId: user.uid, online: body.online, availabilityState: body.online ? "online_current" : "offline", currentLocation: body.online ? location : null,
      locationUpdatedAt: body.online ? FieldValue.serverTimestamp() : null, lastHeartbeatAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("drivers").doc(user.uid).set({ status: body.online ? "active" : (driver.status === "active" ? "ready" : driver.status), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true, online: body.online, eligibility });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Location state is invalid." }, { status: 400 });
    return apiError(error);
  }
}
