import {z} from "zod";
import {apiError,authenticateRequest} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
import {getVerifiedRideRoute,routingConfiguration} from "@/lib/ride-routing";

export const runtime="nodejs";
// These are fixed operational test routes, not customer coordinates.
// Probe must never create a trip, modify launch settings, or charge a customer.
const PROBES={
 ZW:{city:"Harare",from:{lat:-17.8338,lng:31.0385},to:{lat:-17.7588,lng:31.0835}},
 MW:{city:"Lilongwe",from:{lat:-13.9626,lng:33.7754},to:{lat:-13.9837,lng:33.7867}}
};
const roles=["super_admin","admin","platform_admin","operations_manager","regional_operations_manager","driver_operations_coordinator","dispatcher","support_manager"];

export async function GET(request){
 try{
  await authenticateRequest(request,{roles});
  const {ready,provider,authenticated,reason}=routingConfiguration();
  return Response.json({ok:true,configured:ready,provider,credentialsConfigured:authenticated,
   message:reason||"Endpoint and key are configured. A live test is still required.",
   availableProbes:Object.keys(PROBES)},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return apiError(e);}
}

export async function POST(request){
 try{
  const user=await authenticateRequest(request,{roles});
  await enforceRateLimit(request,{key:"admin_mobility_route_probe",limit:8,windowMs:3600000,identity:user.uid});
  const data=z.object({country:z.enum(["ZW","MW"])}).strict().parse(await request.json());
  const probe=PROBES[data.country];
  const start=Date.now();
  const result=await getVerifiedRideRoute(probe.from,probe.to);
  return Response.json({ok:true,city:probe.city,country:data.country,
   distanceKm:result.distanceKm,durationMinutes:result.durationMinutes,source:result.source,
   durationMs:Date.now()-start,
   message:"Real road routing succeeded. Approve pricing, geofences and operational safety separately."},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Choose Zimbabwe or Malawi for a route test."},{status:422});
  return apiError(error);
 }
}
