import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { normalizeLocation } from "@/lib/driver-delivery-server";
import {enforceRateLimit} from "@/lib/rate-limit-server";

export const runtime = "nodejs";
const schema = z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() });

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
    await enforceRateLimit(request,{key:"driver-gps",limit:10,windowMs:60000,identity:user.uid});
    const location = normalizeLocation(schema.parse(await request.json()));
    if (!location) throw Object.assign(new Error("The location coordinates are invalid."), { status: 400 });
    const { db } = getAdminServices();
    const ref = db.collection("driverPresence").doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists || snap.data().online !== true) throw Object.assign(new Error("Go online before sharing operational location."), { status: 409 });
    await ref.set({ currentLocation: location, availabilityState: availabilityState(snap.data()), locationUpdatedAt: FieldValue.serverTimestamp(), lastHeartbeatAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The location coordinates are invalid." }, { status: 400 });
    return apiError(error);
  }
}
