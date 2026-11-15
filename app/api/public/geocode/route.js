import { enforceRateLimit } from "@/lib/rate-limit-server";
import { apiError, verifyAppCheckRequest } from "@/lib/firebase-admin";
import {mapTilerReady,mapTilerSearchUrl,requestMapTiler,mapTilerForwardResults} from "@/lib/maptiler-geocoding";
import {uniquePlaceIntents,isSecondaryGeocoderEnabled} from "@/lib/spotly-place-intent";

export const runtime = "nodejs";
const clean = (value, max = 160) => String(value || "").trim().slice(0, max);

async function mapTilerPlaces({q,city,country,origin}) {
  const url=mapTilerSearchUrl({query:q,city,country});
  const data=await requestMapTiler(url,{origin});
  return uniquePlaceIntents(mapTilerForwardResults(data,country),{country,provider:"maptiler"});
}

async function licensedPlaces({endpoint,query,country,city}) {
  const geocoder=new URL(endpoint);
  if(geocoder.protocol!=="https:"||geocoder.username||geocoder.password||
      geocoder.hostname.toLowerCase()==="nominatim.openstreetmap.org")
    throw Object.assign(new Error("A production-licensed search provider is required."),{status:503});
  // The configured endpoint must be a licensed, operator-controlled provider;
  // never accept a URL from the caller. Do not log query coordinates or tokens.
  geocoder.searchParams.set("format","jsonv2");
  geocoder.searchParams.set("addressdetails","1");
  geocoder.searchParams.set("limit","6");
  geocoder.searchParams.set("countrycodes",country.toLowerCase());
  geocoder.searchParams.set("q",query);
  let response;
  try {
    response=await fetch(geocoder.toString(),{
      headers:{"User-Agent":process.env.SPOTLY_GEOCODING_USER_AGENT||"Spotly/6.2 (support@spotlyafrica.com)","Accept-Language":"en"},
      signal:AbortSignal.timeout(5500),next:{revalidate:300}
    });
  } catch {
    throw Object.assign(new Error("Location search is temporarily unavailable."),{status:503});
  }
  if(!response.ok)throw Object.assign(new Error("Location search is temporarily unavailable."),{status:503});
  let raw;
  try {raw=await response.json();} catch {
    throw Object.assign(new Error("Location search returned invalid data."),{status:503});
  }
  const rows=(Array.isArray(raw)?raw:[]).map(item=>({
    id:String(item.place_id||`${item.lat}_${item.lon}`),
    label:clean(item.display_name,300),lat:Number(item.lat),lng:Number(item.lon),
    area:clean(item.address?.suburb||item.address?.neighbourhood||item.address?.quarter||item.address?.city_district||"",120),
    city:clean(item.address?.city||item.address?.town||item.address?.village||city||"",120),
    country:String(item.address?.country_code||"").toUpperCase(),
    locationType:item.type==="attraction"||item.type==="amenity"?"landmark":"address"
  }));
  return uniquePlaceIntents(rows,{country,provider:"licensed"});
}

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request,{required:false});
    await enforceRateLimit(request,{key:"public_geocode",limit:20,windowMs:60_000});
    const url=new URL(request.url),q=clean(url.searchParams.get("q"),140);
    if(q.length<3)return Response.json({ok:true,results:[]});
    const city=clean(url.searchParams.get("city"),80);
    const country=clean(url.searchParams.get("country")||"ZW",2).toUpperCase();
    if(!["ZW","MW"].includes(country))return Response.json({ok:false,error:"Country is not supported."},{status:422});
    const endpoint=process.env.SPOTLY_GEOCODING_URL;
    const origin=url.origin;
    // Keep the existing single-provider path as the default; secondary lookup
    // is explicitly opt-in because it costs API calls and needs contract review.
    if(!endpoint&&mapTilerReady()) {
      const results=await mapTilerPlaces({q,city,country,origin});
      return Response.json({ok:true,results},{headers:{"Cache-Control":"private, max-age=120"}});
    }
    if(!endpoint)throw Object.assign(new Error("Licensed location search is not configured."),{status:503});
    const query=[q,city,country==="MW"?"Malawi":"Zimbabwe"].filter(Boolean).join(", ");
    const secondary=isSecondaryGeocoderEnabled()&&mapTilerReady();
    let results=[],primaryFailure=null;
    try {results=await licensedPlaces({endpoint,query,country,city});}
    catch(error){primaryFailure=error;if(!secondary)throw error;}
    if(secondary&&(primaryFailure||results.length===0)) {
      try {
        const alternative=await mapTilerPlaces({q,city,country,origin});
        // Never return results with an invalid country or uncertain coordinates.
        if(alternative.length)return Response.json({ok:true,results:alternative},{headers:{"Cache-Control":"private, max-age=120"}});
      } catch { /* The original error is more actionable to operators. */ }
    }
    if(primaryFailure)throw primaryFailure;
    return Response.json({ok:true,results},{headers:{"Cache-Control":"private, max-age=120"}});
  } catch(error) {return apiError(error);}
}
