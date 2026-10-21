import {apiError,verifyAppCheckRequest} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
import {mapTilerReady,mapTilerReverseUrl,requestMapTiler,mapTilerReverseLocation} from "@/lib/maptiler-geocoding";
export const runtime="nodejs";
export async function GET(request){
 try{
  await verifyAppCheckRequest(request,{required:false});
  await enforceRateLimit(request,{key:"public_reverse_geocode",limit:12,windowMs:60000});
  const q=new URL(request.url).searchParams;
  const lat=Number(q.get("lat")),lng=Number(q.get("lng"));
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180)
   return Response.json({ok:false,error:"Invalid coordinates."},{status:400});
  const endpoint=process.env.SPOTLY_REVERSE_GEOCODING_URL;
  if(!endpoint&&mapTilerReady()){
    const url=mapTilerReverseUrl({lat,lng});
    const result=await requestMapTiler(url,{origin:new URL(request.url).origin});
    const location=mapTilerReverseLocation(result,lat,lng);
    return Response.json({ok:true,location},{headers:{"Cache-Control":"private, no-store"}});
  }
  if(!endpoint)throw Object.assign(new Error("Licensed location identification is not configured. Configure MapTiler or a compatible reverse-geocoding service."),{status:503});
  const target=new URL(endpoint);
  if(target.protocol!=="https:"||target.hostname==="nominatim.openstreetmap.org")
   throw Object.assign(new Error("Licensed geocoding is required."),{status:503});
  target.searchParams.set("format","jsonv2");target.searchParams.set("addressdetails","1");
  target.searchParams.set("lat",String(lat));target.searchParams.set("lon",String(lng));
  const response=await fetch(target,{headers:{"User-Agent":"Spotly Ride/9 (support@spotlyafrica.com)"},signal:AbortSignal.timeout(5500),cache:"no-store"});
  if(!response.ok)throw Object.assign(new Error("Location identification is temporarily unavailable."),{status:503});
  const raw=await response.json(),a=raw.address||{};
  const country=String(a.country_code||"").toUpperCase();
  if(!["ZW","MW"].includes(country))throw Object.assign(new Error("Location is outside Spotly Ride countries."),{status:409});
  const city=String(a.city||a.town||a.village||"").slice(0,120);
  const area=String(a.suburb||a.neighbourhood||a.city_district||"").slice(0,120);
  if(!city)throw Object.assign(new Error("Select the correct pickup city using address search."),{status:409});
  return Response.json({ok:true,location:{lat,lng,city,area,country,
    label:String(raw.name||"Current location").slice(0,160),
    formattedAddress:String(raw.display_name||"Current location").slice(0,500)}},
    {headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}
