import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { operationalEligibility, normalizeLocation } from "@/lib/driver-delivery-server";
import { DRIVER_CAPABILITIES, capabilitySummary } from "@/lib/driver-capabilities";

export const runtime = "nodejs";
const schema = z.object({ online: z.boolean(), vehicleId: z.string().max(120).optional(), enabledCapabilities: z.array(z.enum(Object.keys(DRIVER_CAPABILITIES))).max(8).optional(), location: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }).optional() });

function availabilityState(presence) {
  if (!presence?.currentJobId) return "online_current";
  if (presence.currentWorkType === "ride") return "on_ride";
  if (presence.currentWorkType === "send") return "on_send";
  if (presence.currentWorkType === "shop_and_deliver") return "shopping";
  return "on_delivery";
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request);
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const presenceRef = db.collection("driverPresence").doc(user.uid);
    const [driverSnap, applicationSnap, vehicleQuery, documentQuery, presenceSnap] = await Promise.all([
      db.collection("drivers").doc(user.uid).get(),
      db.collection("driverApplications").doc(user.uid).get(),
      db.collection("driverVehicles").where("driverId", "==", user.uid).limit(10).get(),
      db.collection("driverDocuments").where("driverId", "==", user.uid).limit(50).get(),
      presenceRef.get()
    ]);
    const driver = driverSnap.exists ? driverSnap.data() : null;
    if (!driver) throw Object.assign(new Error("Your Driver application is not approved yet."), { status: 403 });
    const application = applicationSnap.exists ? applicationSnap.data() : {};
    const vehicles = vehicleQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const documents = documentQuery.docs.map((item) => ({ id: item.id, ...item.data() }));
    const current = presenceSnap.exists ? presenceSnap.data() : null;
    const selectedVehicle = vehicles.find((item) => item.id === (body.vehicleId || current?.vehicleId || driver.selectedVehicleId)) || vehicles.find((item) => item.status === "approved") || vehicles[0] || null;
    const capabilityRows = capabilitySummary({ driver, application, vehicle: selectedVehicle, documents });
    const activeCapabilities = capabilityRows.filter((item) => item.ready).map((item) => item.id);
    const requestedSessionCapabilities = Array.isArray(body.enabledCapabilities) ? body.enabledCapabilities.filter((id) => activeCapabilities.includes(id)) : (Array.isArray(current?.enabledCapabilities) && current.enabledCapabilities.length ? current.enabledCapabilities.filter((id) => activeCapabilities.includes(id)) : activeCapabilities);
    const eligibility = operationalEligibility({ driver, application, vehicle: selectedVehicle, documents, presence: current });
    if (body.online && !requestedSessionCapabilities.length) throw Object.assign(new Error("Choose at least one active work type before going online."), { status: 409 });
    if (!body.online && current?.currentJobId) throw Object.assign(new Error("Finish your active job before going offline."), { status: 409 });
    if (body.online && !eligibility.eligible) {
      return Response.json({ ok: false, error: "You cannot go online yet.", blockers: eligibility.checks.filter((item) => !item.ok), eligibility }, { status: 409 });
    }
    const location = body.location ? normalizeLocation(body.location) : null;
    if (body.online && !location) throw Object.assign(new Error("Turn on location to receive nearby deliveries."), { status: 409 });
    await presenceRef.set({
      driverId: user.uid, online: body.online, vehicleId: selectedVehicle?.id || null, enabledCapabilities: body.online ? requestedSessionCapabilities : (current?.enabledCapabilities || activeCapabilities), availabilityState: body.online ? availabilityState(current) : "offline", currentLocation: body.online ? location : null,
      locationUpdatedAt: body.online ? FieldValue.serverTimestamp() : null, lastHeartbeatAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await db.collection("drivers").doc(user.uid).set({ status: body.online ? "active" : (driver.status === "active" ? "ready" : driver.status), selectedVehicleId: selectedVehicle?.id || driver.selectedVehicleId || null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true, online: body.online, eligibility });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "Location state is invalid." }, { status: 400 });
    return apiError(error);
  }
}
