import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {rideSettings} from "@/lib/ride-server";
import {parcelSettings} from "@/lib/parcel-server";
import {dispatchHealth} from "@/lib/mobility-scheduler-health";
import {licensedMapStyle} from "@/lib/mobility-map-provider";
import {paynowCredentialsConfigured} from "@/lib/paynow-server";

export const runtime="nodejs";
const READ_ROLES=["super_admin","admin","platform_admin","operations_manager","regional_operations_manager","driver_operations_coordinator","dispatcher","support_manager"];
const WRITE_ROLES=["super_admin","admin","platform_admin","operations_manager"];
const schema=z.object({
 service:z.enum(["ride","send"]),action:z.enum(["enable","disable"]),
 confirmation:z.string().max(70).optional()
}).strict();
function prerequisites(settings,service,heartbeat=null,paynowByCurrency={}){
 const missing=[];
 const mobility=settings.mobility||{},config=service==="ride"?rideSettings(settings):parcelSettings(settings);
 const cities=config.enabledCities||[];
 if(!cities.length)missing.push("Approve at least one pickup city");
 if(!config.paymentMethods?.length)missing.push("Approve an available payment method");
 const currency=config.pricing?.currency==="ZWG"?"ZWG":"USD";
 const paynowReady=paynowByCurrency[currency]===true;
 if(config.paynowEnabled&&!paynowReady)
  missing.push("Configure actual Paynow merchant credentials for "+currency+" before offering Paynow checkout");
 if(config.dispatchSchedulerVerified!==true)missing.push("Verify a real external dispatch scheduler");
 const scheduler=dispatchHealth(heartbeat||{});
 if(!scheduler.ready)missing.push("Prove at least 3 recent authenticated scheduler ticks with no dispatch failures (last within 3.5 minutes)");
 if(config.routingVerified!==true||!process.env.SPOTLY_ROUTING_URL)missing.push("Configure and verify HTTPS road routing");
 if(!licensedMapStyle())missing.push("Configure licensed MapLibre street tiles (SPOTLY_MAP_STYLE_URL)");
 if(!process.env.SPOTLY_GEOCODING_URL||!process.env.SPOTLY_REVERSE_GEOCODING_URL)
  missing.push("Configure licensed forward and reverse geocoding");
 if(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32)
  missing.push("Configure a secure dispatch scheduler authorization secret");
 const pin=service==="ride"?"SPOTLY_RIDE_PIN_KEY":"SPOTLY_SEND_PIN_KEY";
 if(!process.env[pin]||process.env[pin].length<32)missing.push("Configure a separate secure "+service+" PIN encryption key");
 if(service==="ride"&&!config.enabledCountries?.length)
  missing.push("Approve countries for Ride (Zimbabwe / Malawi)");
 const fences=config.cityGeofences||{};
 const countries=service==="ride"?config.enabledCountries||[]:["ZW"];
 for(const city of cities){
  const matches=countries.filter(country=>fences[country+":"+String(city).toLowerCase()]);
  if(!matches.length)missing.push("Approve a country-specific service geofence for "+city);
 }
 return {service,enabled:service==="ride"?mobility.ridesEnabled===true:mobility.send?.enabled===true,
  ready:missing.length===0,missing,cityCount:cities.length,geoFenceCount:Object.keys(fences).length,
  schedulerVerified:config.dispatchSchedulerVerified===true,scheduler,paynowCredentialsConfigured:paynowReady};
}
export async function GET(request){
 try{
  await authenticateRequest(request,{roles:READ_ROLES});
  const {db}=getAdminServices();
  const [doc,rideHealth,sendHealth,usdPaynow,zwgPaynow]=await Promise.all([
    db.collection("platformSettings").doc("global").get(),
    db.collection("mobilityDispatchHealth").doc("ride").get(),
    db.collection("mobilityDispatchHealth").doc("send").get(),
    paynowCredentialsConfigured("USD").catch(()=>false),
    paynowCredentialsConfigured("ZWG").catch(()=>false)
  ]);
  const settings=doc.exists?doc.data():{};
  return Response.json({ok:true,services:[
    prerequisites(settings,"ride",rideHealth.data(),{USD:usdPaynow,ZWG:zwgPaynow}),
    prerequisites(settings,"send",sendHealth.data(),{USD:usdPaynow,ZWG:zwgPaynow})]},
   {headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles:WRITE_ROLES});
  const data=schema.parse(await request.json()),{db}=getAdminServices();
  const confirmation=data.action==="enable"?"ENABLE SPOTLY "+data.service.toUpperCase():"DISABLE SPOTLY "+data.service.toUpperCase();
  if(data.confirmation!==confirmation)
   throw Object.assign(new Error("Type "+confirmation+" to confirm this service change."),{status:409});
  const ref=db.collection("platformSettings").doc("global");
  const [usdPaynow,zwgPaynow]=await Promise.all([
    paynowCredentialsConfigured("USD").catch(()=>false),
    paynowCredentialsConfigured("ZWG").catch(()=>false)
  ]);
  let after;
  await db.runTransaction(async tx=>{
   const doc=await tx.get(ref);
   const healthDoc=await tx.get(db.collection("mobilityDispatchHealth").doc(data.service));
   const current=doc.exists?doc.data():{},mobility=current.mobility||{};
   const prereq=prerequisites(current,data.service,healthDoc.data(),{USD:usdPaynow,ZWG:zwgPaynow});
   if(data.action==="enable"&&!prereq.ready)
    throw Object.assign(new Error("Cannot enable "+data.service+": "+prereq.missing.join("; ")),{status:409});
   if(data.service==="ride"){
    after={...mobility,ridesEnabled:data.action==="enable"};
   }else{
    after={...mobility,send:{...(mobility.send||{}),enabled:data.action==="enable"}};
   }
   const now=FieldValue.serverTimestamp();
   tx.set(ref,{mobility:after,updatedAt:now,updatedBy:actor.uid},{merge:true});
   tx.create(db.collection("auditLogs").doc(),{
    actorId:actor.uid,action:"mobility."+data.service+".launch_"+data.action,
    entityType:"platformSettings",entityId:"global",
    metadata:{service:data.service,enabled:data.action==="enable",
      approvedCities:prereq.cityCount,schedulerVerified:prereq.schedulerVerified},
    createdAt:now
   });
  });
  return Response.json({ok:true,service:data.service,enabled:data.action==="enable",
   warning:"This switch does not verify real-world Driver coverage or authorize test payments."});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review service launch instructions."},{status:422});
  return apiError(error);
 }
}
