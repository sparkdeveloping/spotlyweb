import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { normalizeRidePoint, estimateRide, rideQuoteAvailability } from "@/lib/ride-server";
import { validateRideTerritory } from "@/lib/ride-geography";
import { getVerifiedRideRoute } from "@/lib/ride-routing";
import { loadOperationGrants, requireOperationGrant } from "@/lib/operations-grants-server";
import { hasOperationGrant } from "@/lib/operations-grants";
import { validateOperationsRideLocations } from "@/lib/operations-run-validation";

export const runtime = "nodejs";
const point = z.object({ lat: z.number().finite(), lng: z.number().finite(), country: z.enum(["ZW", "MW"]), label: z.string().max(160).optional(), formattedAddress: z.string().max(500).optional(), city: z.string().max(100).optional(), area: z.string().max(100).optional(), accuracy: z.number().finite().optional() });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), pickup: point, dropoff: point, serviceType: z.enum(["economy", "comfort", "xl"]).default("economy") }).strict(),
  z.object({ action: z.literal("accept"), runId: z.string().min(8).max(180) }).strict(),
  z.object({ action: z.literal("advance"), runId: z.string().min(8).max(180) }).strict(),
  z.object({ action: z.literal("cancel"), runId: z.string().min(8).max(180) }).strict()
]);
const NEXT = Object.freeze({ driver_assigned: "driver_to_pickup", driver_to_pickup: "driver_arrived_pickup", driver_arrived_pickup: "in_trip", in_trip: "completed" });
const END = new Set(["completed", "cancelled"]);
function plain(id, data) { return { id, kind: "ride", operations: true, state: data.state, customerId: data.customerId, driverId: data.driverId || null, pickup: data.pickup, dropoff: data.dropoff, serviceType: data.serviceType, quote: data.quote || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null, updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null }; }

export async function GET(request) {
  try {
    const user = await authenticateRequest(request); const { db } = getAdminServices();
    const grants = await loadOperationGrants(db, user.uid);
    const canRequest = hasOperationGrant(grants, { type: "service_operations", service: "ride" });
    const canDrive = hasOperationGrant(grants, { type: "driver_operations", service: "ride" });
    if (!canRequest && !canDrive) return Response.json({ ok: true, allowed: false, canRequest: false, canDrive: false, myRuns: [], offers: [] }, { headers: { "Cache-Control": "private, no-store" } });
    const snapshot = await db.collection("operationsRuns").orderBy("updatedAt", "desc").limit(100).get();
    const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((row) => row.kind === "ride");
    const myRuns = rows.filter((row) => row.customerId===user.uid || row.driverId===user.uid).slice(0,20).map((row)=>plain(row.id,row));
    const offers = canDrive ? rows.filter((row)=>row.state==="searching_driver" && row.customerId!==user.uid && hasOperationGrant(grants,{type:"driver_operations",service:"ride",country:row.pickup?.country,city:row.pickup?.city})).slice(0,20).map((row)=>plain(row.id,row)) : [];
    return Response.json({ ok: true, allowed: canRequest || canDrive, canRequest, canDrive, myRuns, offers }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request) {
  try {
    const user = await authenticateRequest(request); const { db } = getAdminServices();
    await enforceRateLimit(request, { key: "operations-rides", limit: 24, windowMs: 60_000, identity: user.uid });
    const input = schema.parse(await request.json()); const now = FieldValue.serverTimestamp(); const runs = db.collection("operationsRuns");
    if (input.action === "request") {
      const pickup = normalizeRidePoint(input.pickup); const dropoff = normalizeRidePoint(input.dropoff);
      if (!pickup || !dropoff) throw Object.assign(new Error("Choose valid pickup and destination locations."), { status: 400 });
      const validation = validateOperationsRideLocations(pickup, dropoff); if (!validation.ok) throw Object.assign(new Error(validation.error), { status: 400 });
      await requireOperationGrant(db, user.uid, { type: "service_operations", service: "ride", country: pickup.country, city: pickup.city });
      const settingsSnap = await db.collection("platformSettings").doc("global").get(); const settings=settingsSnap.data()||{};
      const readiness=rideQuoteAvailability(settings,pickup); if(!readiness.enabled) throw Object.assign(new Error(readiness.reason),{status:409});
      validateRideTerritory(pickup,dropoff,settings.mobility||{}); const route=await getVerifiedRideRoute(pickup,dropoff); const quote=estimateRide({pickup,dropoff,serviceType:input.serviceType,settings,route});
      const ref=runs.doc(); await ref.create({ kind:"ride", mode:"operations", operations:true, customerId:user.uid, driverId:null, state:"searching_driver", pickup, dropoff, serviceType:input.serviceType, quote, financialIsolation:true, productionCollectionsUntouched:true, createdAt:now, updatedAt:now });
      return Response.json({ok:true,runId:ref.id,state:"searching_driver",operations:true,quote});
    }
    const ref=runs.doc(input.runId); let state="";
    const driverGrants = input.action === "accept" || input.action === "advance" ? await loadOperationGrants(db, user.uid) : [];
    await db.runTransaction(async(tx)=>{ const snap=await tx.get(ref); if(!snap.exists||snap.data()?.kind!=="ride")throw Object.assign(new Error("This Operations Ride no longer exists."),{status:404}); const data=snap.data(); if(END.has(data.state))throw Object.assign(new Error("This Operations Ride is already finished."),{status:409});
      if(input.action==="accept"){ if(!hasOperationGrant(driverGrants,{type:"driver_operations",service:"ride",country:data.pickup?.country,city:data.pickup?.city}))throw Object.assign(new Error("This account does not have the required Operations Driver grant for this run."),{status:403,code:"operations_grant_required"}); if(data.customerId===user.uid)throw Object.assign(new Error("Use another granted account as the Operations Driver."),{status:403}); if(data.state!=="searching_driver"||data.driverId)throw Object.assign(new Error("Another Operations Driver already accepted this run."),{status:409}); state="driver_assigned"; tx.update(ref,{state,driverId:user.uid,acceptedAt:now,updatedAt:now}); }
      else if(input.action==="advance"){ if(!hasOperationGrant(driverGrants,{type:"driver_operations",service:"ride",country:data.pickup?.country,city:data.pickup?.city}))throw Object.assign(new Error("This account does not have the required Operations Driver grant for this run."),{status:403,code:"operations_grant_required"}); if(data.driverId!==user.uid||!NEXT[data.state])throw Object.assign(new Error("This Operations state cannot be advanced by your account."),{status:403}); state=NEXT[data.state]; tx.update(ref,{state,updatedAt:now}); }
      else { if(data.customerId!==user.uid&&data.driverId!==user.uid)throw Object.assign(new Error("Only participants can cancel this Operations run."),{status:403}); state="cancelled"; tx.update(ref,{state,updatedAt:now}); }
    });
    return Response.json({ok:true,runId:input.runId,state,operations:true});
  } catch(error){ if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the Operations Ride details."},{status:400}); return apiError(error); }
}
