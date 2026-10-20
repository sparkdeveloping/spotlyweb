import { enforceRateLimit } from "@/lib/rate-limit-server";
import { apiError, verifyAppCheckRequest } from "@/lib/firebase-admin";
import {mapTilerReady,mapTilerSearchUrl,requestMapTiler,mapTilerForwardResults} from "@/lib/maptiler-geocoding";

export const runtime = "nodejs";

function clean(value, max = 160) { return String(value || "").trim().slice(0, max); }

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request, { required: false });
    await enforceRateLimit(request, { key: "public_geocode", limit: 20, windowMs: 60_000 });
    const url = new URL(request.url);
    const q = clean(url.searchParams.get("q"), 140);
    if (q.length < 3) return Response.json({ ok: true, results: [] });
    const city = clean(url.searchParams.get("city"), 80);
    const country=clean(url.searchParams.get("country")||"ZW",2).toUpperCase();
    if(!["ZW","MW"].includes(country))return Response.json({ok:false,error:"Country is not supported."},{status:422});
    const query = [q, city, country==="MW"?"Malawi":"Zimbabwe"].filter(Boolean).join(", ");
    const endpoint=process.env.SPOTLY_GEOCODING_URL;
    if(!endpoint&&mapTilerReady()){
      const url=mapTilerSearchUrl({query:q,city,country});
      const data=await requestMapTiler(url,{origin:new URL(request.url).origin});
      const results=mapTilerForwardResults(data,country);
      return Response.json({ok:true,results},{headers:{"Cache-Control":"private, max-age=120"}});
    }
    if(!endpoint)throw Object.assign(new Error("Licensed location search is not configured. Configure MapTiler or a compatible geocoding service."),{status:503});
    const geocoder=new URL(endpoint);
    if(geocoder.protocol!=="https:"||geocoder.hostname==="nominatim.openstreetmap.org")
      throw Object.assign(new Error("A production-licensed search provider is required."),{status:503});
    // Retain provider API tokens and other operator-configured query params.
    // Only a Nominatim-compatible, production-licensed backend is supported here.
    geocoder.searchParams.set("format","jsonv2");
    geocoder.searchParams.set("addressdetails","1");
    geocoder.searchParams.set("limit","6");
    geocoder.searchParams.set("countrycodes",country.toLowerCase());
    geocoder.searchParams.set("q",query);
    const target=geocoder.toString();
    const response = await fetch(target, { headers: { "User-Agent": process.env.SPOTLY_GEOCODING_USER_AGENT || "Spotly/6.2 (support@spotlyafrica.com)", "Accept-Language": "en" }, signal:AbortSignal.timeout(5500),next: { revalidate: 300 } });
    if (!response.ok) throw Object.assign(new Error("Location search is temporarily unavailable."), { status: 503 });
    const raw = await response.json();
    const results = (Array.isArray(raw) ? raw : []).map((item) => ({
      id: String(item.place_id || `${item.lat}_${item.lon}`),
      label: clean(item.display_name, 300),
      lat: Number(item.lat), lng: Number(item.lon),
      area: clean(item.address?.suburb || item.address?.neighbourhood || item.address?.quarter || item.address?.city_district || "", 120),
      city: clean(item.address?.city || item.address?.town || item.address?.village || city || "", 120),
      country:String(item.address?.country_code||"").toUpperCase()
    })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)&&item.country===country);
    return Response.json({ ok: true, results });
  } catch (error) { return apiError(error); }
}
