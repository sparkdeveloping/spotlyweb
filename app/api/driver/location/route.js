import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { normalizeLocation,haversineKm } from "@/lib/driver-delivery-server";
import {enforceRateLimit} from "@/lib/rate-limit-server";

export const runtime = "nodejs";
const schema=z.object({
  lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),
  accuracy:z.number().finite().positive().max(150),
  fixAgeMs:z.number().finite().min(0).max(30000).optional()
});

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
    const input=schema.parse(await request.json());
    const location=normalizeLocation(input);
    if (!location) throw Object.assign(new Error("The location coordinates are invalid."), { status: 400 });
    const { db } = getAdminServices();
    const ref = db.collection("driverPresence").doc(user.uid);
    await db.runTransaction(async transaction=>{
      const snap=await transaction.get(ref);
      if(!snap.exists||snap.data().online!==true)
        throw Object.assign(new Error("Go online before sharing operational location."),{status:409});
      const presence=snap.data(),previous=presence.currentLocation;
      const previousAt=presence.locationUpdatedAt?.toMillis?.()||0;
      const elapsed=(Date.now()-previousAt)/1000;
      if(previous&&previousAt&&elapsed>=0&&elapsed<180){
        const travelKm=haversineKm(previous,location);
        if(Number.isFinite(travelKm)&&travelKm>0.45+elapsed*.065)
         throw Object.assign(new Error("GPS position jumped unexpectedly. Move outdoors or wait for a stable fix."),{status:409});
      }
      const now=FieldValue.serverTimestamp();
      transaction.set(ref,{currentLocation:location,gpsAccuracyMeters:input.accuracy,
        availabilityState:availabilityState(presence),locationUpdatedAt:now,
        lastHeartbeatAt:now,updatedAt:now},{merge:true});
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ ok: false, error: "The location coordinates are invalid." }, { status: 400 });
    return apiError(error);
  }
}
