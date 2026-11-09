import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {rideSettings} from "@/lib/ride-server";
import {parcelSettings} from "@/lib/parcel-server";
import {dispatchHealth} from "@/lib/mobility-scheduler-health";
import {licensedMapStyle} from "@/lib/mobility-map-provider";
import {mapTilerReady} from "@/lib/maptiler-geocoding";
import {paynowCredentialsConfigured} from "@/lib/paynow-server";
import {routingConfiguration} from "@/lib/ride-routing";
import {resolveServiceAvailability,serviceAvailabilityCityKey} from "@/lib/service-availability";
import {editServiceAvailabilityDraft} from "@/lib/service-availability-control-plane-server";

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
 if(config.routingVerified!==true||!routingConfiguration().ready)missing.push("Configure, authenticate and verify real HTTPS road routing");
 if(!licensedMapStyle())missing.push("Configure licensed MapLibre street tiles (SPOTLY_MAP_STYLE_URL)");
 if(!((process.env.SPOTLY_GEOCODING_URL&&process.env.SPOTLY_REVERSE_GEOCODING_URL)||mapTilerReady()))
  missing.push("Configure licensed forward and reverse geocoding (MapTiler key or compatible services)");
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
 const countriesForRuntime=service==="ride"?(config.enabledCountries||[]):["ZW"];
 const runtimeLive=cities.some(city=>countriesForRuntime.some(country=>resolveServiceAvailability(settings,{service,country,city}).state==="live"));
 return {service,enabled:runtimeLive,
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
  const [settingsDoc,healthDoc,usdPaynow,zwgPaynow]=await Promise.all([
   ref.get(),db.collection("mobilityDispatchHealth").doc(data.service).get(),
   paynowCredentialsConfigured("USD").catch(()=>false),paynowCredentialsConfigured("ZWG").catch(()=>false)
  ]);
  const current=settingsDoc.exists?settingsDoc.data():{};
  const prereq=prerequisites(current,data.service,healthDoc.data(),{USD:usdPaynow,ZWG:zwgPaynow});
  if(data.action==="enable"&&!prereq.ready)
   throw Object.assign(new Error("Cannot stage "+data.service+" live: "+prereq.missing.join("; ")),{status:409});
  const config=data.service==="ride"?rideSettings(current):parcelSettings(current);
  const countries=data.service==="ride"?(config.enabledCountries||[]):["ZW"];
  for(const country of countries){
   await editServiceAvailabilityDraft(db,actor,{service:data.service,scope:"country",country,state:data.action==="enable"?"discover":"paused",reason:data.action==="enable"?"":"Temporarily paused by Spotly Operations."});
   for(const city of config.enabledCities||[]){
    const key=serviceAvailabilityCityKey(country,city); if(!key)continue;
    if(data.service==="ride"&&!config.cityGeofences?.[country+":"+String(city).toLowerCase()])continue;
    await editServiceAvailabilityDraft(db,actor,{service:data.service,scope:"city",country,city,state:data.action==="enable"?"live":"paused",reason:data.action==="enable"?"":"Temporarily paused by Spotly Operations."});
   }
  }
  await db.collection("auditLogs").add({
   actorId:actor.uid,actorEmail:actor.email||"",action:"mobility."+data.service+".availability_staged",
   entityType:"serviceAvailability",entityId:data.service,
   metadata:{service:data.service,action:data.action,approvedCities:prereq.cityCount,schedulerVerified:prereq.schedulerVerified},
   createdAt:FieldValue.serverTimestamp()
  });
  return Response.json({ok:true,service:data.service,staged:true,
   warning:"Availability is staged only. Publish it from System → Countries & Services before production changes."});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review service launch instructions."},{status:422});
  return apiError(error);
 }
}
