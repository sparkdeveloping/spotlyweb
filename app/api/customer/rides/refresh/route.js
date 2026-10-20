import {z} from "zod";
import {authenticateRequest,apiError,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
import {dispatchRide} from "@/lib/ride-server";
export const runtime="nodejs";
const schema=z.object({rideId:z.string().min(3).max(180)}).strict();
/** Rider-open fallback for retrying expired offers; an external trusted scheduler
 * remains required for recovery when neither rider nor Driver is connected. */
export async function POST(request){
 try{
  const user=await authenticateRequest(request);
  await enforceRateLimit(request,{key:"ride_dispatch_refresh",limit:30,windowMs:600000,identity:user.uid});
  const {rideId}=schema.parse(await request.json());
  const {db,messaging}=getAdminServices();
  const rideSnap=await db.collection("rideTrips").doc(rideId).get();
  if(!rideSnap.exists||rideSnap.data().customerId!==user.uid)
   throw Object.assign(new Error("Ride is not available."),{status:404});
  const ride=rideSnap.data();
  if(!["requested","searching_driver"].includes(ride.state))return Response.json({ok:true,state:ride.state,skipped:true});
  const recent=ride.dispatchAttemptedAt?.toMillis?.()||0;
  if(Date.now()-recent<18000)return Response.json({ok:true,state:ride.state,skipped:true});
  const result=await dispatchRide({db,messaging,rideId,actorId:"customer_dispatch_refresh"});
  return Response.json({ok:true,state:result.timedOut?"failed":"searching_driver",dispatch:result},
    {headers:{"Cache-Control":"private, no-store"}});
 }catch(e){if(e instanceof z.ZodError)return Response.json({ok:false,error:"Select an active ride."},{status:422});return apiError(e);}
}
