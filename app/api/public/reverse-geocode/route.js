import {enforceRateLimit} from "@/lib/rate-limit-server";
import {apiError,verifyAppCheckRequest} from "@/lib/firebase-admin";
import {mapTilerReady,mapTilerReverseUrl,requestMapTiler,mapTilerReverseLocation,pointWithinCountryEnvelope} from "@/lib/maptiler-geocoding";
import {isSecondaryGeocoderEnabled} from "@/lib/spotly-place-intent";
export const runtime="nodejs";

async function mapTilerPin({lat,lng,origin}) {
  const url=mapTilerReverseUrl({lat,lng});
  const raw=await requestMapTiler(url,{origin});
  const location=mapTilerReverseLocation(raw,lat,lng);
  return {...location,source:"maptiler",locationType:"map_pin",precision:"selected_pin",isVerified:false};
}

async function licensedPin({endpoint,lat,lng}) {
  const target=new URL(endpoint);
  if(target.protocol!=="https:"||target.username||target.password||
      target.hostname.toLowerCase()==="nominatim.openstreetmap.org")
    throw Object.assign(new Error("Licensed geocoding is required."),{status:503});
  target.searchParams.set("format","jsonv2");target.searchParams.set("addressdetails","1");
  target.searchParams.set("lat",String(lat));target.searchParams.set("lon",String(lng));
  let response;
  try {
    response=await fetch(target.toString(),{
      headers:{"User-Agent":"Spotly Ride/9 (support@spotlyafrica.com)"},
      signal:AbortSignal.timeout(5500),cache:"no-store"
    });
  } catch {throw Object.assign(new Error("Location identification is temporarily unavailable."),{status:503});}
  if(!response.ok)throw Object.assign(new Error("Location identification is temporarily unavailable."),{status:503});
  let raw;
  try {raw=await response.json();}catch{throw Object.assign(new Error("Location identification returned invalid data."),{status:503});}
  const a=raw?.address||{},country=String(a.country_code||"").toUpperCase();
  if(!["ZW","MW"].includes(country)||!pointWithinCountryEnvelope(country,lat,lng))
    throw Object.assign(new Error("Location is outside Spotly Ride countries."),{status:409});
  const city=String(a.city||a.town||a.village||"").slice(0,120);
  const area=String(a.suburb||a.neighbourhood||a.city_district||"").slice(0,120);
  if(!city)throw Object.assign(new Error("Select the correct pickup city using address search."),{status:409});
  return {lat,lng,city,area,country,label:String(raw?.name||"Map location").slice(0,160),
    formattedAddress:String(raw?.display_name||"Map location").slice(0,500),
    source:"licensed",locationType:"map_pin",precision:"selected_pin",isVerified:false};
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request,{required:false});
    await enforceRateLimit(request,{key:"public_reverse_geocode",limit:12,windowMs:60000});
    const url=new URL(request.url),q=url.searchParams;
    const lat=Number(q.get("lat")),lng=Number(q.get("lng"));
    if(!q.has("lat")||!q.has("lng")||!Number.isFinite(lat)||!Number.isFinite(lng)||
       lat < -90||lat > 90||lng < -180||lng > 180)
      return Response.json({ok:false,error:"Invalid coordinates."},{status:400});
    const endpoint=process.env.SPOTLY_REVERSE_GEOCODING_URL;
    if(!endpoint&&mapTilerReady()) {
      const location=await mapTilerPin({lat,lng,origin:url.origin});
      return Response.json({ok:true,location},{headers:{"Cache-Control":"private, no-store"}});
    }
    if(!endpoint)throw Object.assign(new Error("Licensed location identification is not configured."),{status:503});
    let location;
    try {location=await licensedPin({endpoint,lat,lng});}
    catch(error) {
      // Do not turn an explicit out-of-country or missing-city validation into
      // another provider's apparent success. Only fail over provider outages.
      if(error.status!==503||!isSecondaryGeocoderEnabled()||!mapTilerReady())throw error;
      try {location=await mapTilerPin({lat,lng,origin:url.origin});}
      catch {throw error;}
    }
    return Response.json({ok:true,location},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error){return apiError(error);}
}
