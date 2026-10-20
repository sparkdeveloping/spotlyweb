/**
 * MapTiler Search adapter for Spotly Ride/Send.
 *
 * Uses the public, origin-restricted token from the configured MapTiler style
 * when a dedicated SPOTLY_MAPTILER_GEOCODING_KEY is not set. Never logs keys.
 * Location coordinates remain server-validated and country-restricted.
 */
const supported = new Set(["ZW","MW"]);
// Conservative sanity envelopes are not service-availability geofences.
// They prevent a provider response for another country being attached to a
// distant pin; dispatch still validates real approved city polygons.
const envelopes={
 ZW:{lat:[-22.5,-15.5],lng:[25,34]},
 MW:{lat:[-17.25,-9.2],lng:[32.6,36.1]}
};
export function pointWithinCountryEnvelope(country,lat,lng){
 const b=envelopes[country];
 return Boolean(b&&lat>=b.lat[0]&&lat<=b.lat[1]&&lng>=b.lng[0]&&lng<=b.lng[1]);
}
const fail = (message, status=503) => {throw Object.assign(new Error(message),{status});};
const tidy = (value,max=200) => String(value || "").trim().slice(0,max);
const types = (f) => [
 ...(Array.isArray(f?.place_type)?f.place_type:[]),
 ...(Array.isArray(f?.place_type_name)?f.place_type_name:[]),
 String(f?.id || "").split(".")[0],
 String(f?.properties?.place_designation || "")
].map(x=>String(x).toLowerCase());
const hasType=(f,needles)=>needles.some(n=>types(f).some(t=>t===n));
const ctx=(f)=>Array.isArray(f?.context)?f.context:[];
export function mapTilerCountry(feature){
 const countries=[
  feature?.properties?.country_code,
  feature?.country_code,
  ...ctx(feature).map(x=>x.country_code || x.properties?.country_code)
 ].map(x=>String(x||"").toUpperCase()).filter(x=>x.length===2);
 return countries.find(x=>supported.has(x)) || "";
}
function taggedCity(f){
 const all=[f,...ctx(f)];
 const city=all.find(x=>hasType(x,["municipality","city","town","village","locality","place"]));
 return tidy(city?.text,120);
}
function featureArea(f){
 const item=[f,...ctx(f)].find(x=>hasType(x,["neighbourhood","suburb","municipal_district","district","quarter"]));
 return tidy(item?.text,120);
}
function position(f){
 const p=Array.isArray(f?.center)?f.center:f?.geometry?.coordinates;
 const lng=Number(p?.[0]),lat=Number(p?.[1]);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
export function mapTilerKey({styleUrl=process.env.SPOTLY_MAP_STYLE_URL,override=process.env.SPOTLY_MAPTILER_GEOCODING_KEY}={}){
 if(override&&/^[A-Za-z0-9_-]{16,180}$/.test(override))return override;
 try{
  const url=new URL(styleUrl);
  if(!["api.maptiler.com","api.maptiler.eu"].includes(url.hostname.toLowerCase()) ||
     url.protocol!=="https:" || !url.pathname.startsWith("/maps/") ||
     !url.pathname.endsWith("/style.json"))return "";
  const key=url.searchParams.get("key")||"";
  return /^[A-Za-z0-9_-]{16,180}$/.test(key)?key:"";
 }catch{return "";}
}
export function mapTilerReady(){return Boolean(mapTilerKey());}
export function mapTilerSearchUrl({query,city,country,key=mapTilerKey()}){
 if(!key)fail("MapTiler search is not configured; set SPOTLY_MAPTILER_GEOCODING_KEY or a MapTiler map style.");
 if(!supported.has(country))fail("Country is not supported.",422);
 const text=[tidy(query,140),tidy(city,80)].filter(Boolean).join(", ");
 const u=new URL("https://api.maptiler.com/geocoding/"+encodeURIComponent(text)+".json");
 u.searchParams.set("key",key);u.searchParams.set("country",country.toLowerCase());
 u.searchParams.set("language","en");u.searchParams.set("limit","6");
 u.searchParams.set("autocomplete","true");
 return u.toString();
}
export function mapTilerReverseUrl({lat,lng,key=mapTilerKey()}){
 if(!key)fail("MapTiler reverse geocoding is not configured.");
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
  fail("Invalid coordinates.",400);
 const url=new URL("https://api.maptiler.com/geocoding/"+lng.toFixed(6)+","+lat.toFixed(6)+".json");
 url.searchParams.set("key",key);url.searchParams.set("language","en");
 return url.toString();
}
export function mapTilerForwardResults(body,country){
 const entries=Array.isArray(body?.features)?body.features:[];
 return entries.map(f=>{
  const loc=position(f),foundCountry=mapTilerCountry(f);
  if(!loc||foundCountry!==country)return null;
  return {
   id:tidy(f.id||String(loc.lat)+"_"+String(loc.lng),180),
   label:tidy(f.place_name||f.text,300),
   lat:loc.lat,lng:loc.lng,area:featureArea(f),city:taggedCity(f),
   country:foundCountry
  };
 }).filter(x=>x&&x.label&&x.city).slice(0,6);
}
export function mapTilerReverseLocation(body,lat,lng){
 const features=Array.isArray(body?.features)?body.features:[];
 const matches=features.map(f=>({f,country:mapTilerCountry(f),city:taggedCity(f)}))
   .filter(x=>supported.has(x.country)&&x.city&&pointWithinCountryEnvelope(x.country,lat,lng));
 if(!matches.length)fail("This map pin could not be verified in a supported Spotly city. Try another location.",409);
 const rank=f=>["address","poi","road","neighbourhood","locality","municipality"].findIndex(t=>hasType(f,[t]));
 matches.sort((a,b)=>{
  const x=rank(a.f),y=rank(b.f);return (x<0?10:x)-(y<0?10:y);
 });
 const {f,country,city}=matches[0];
 const area=featureArea(f);
 const label=tidy(f.text||f.address||"Map location",160);
 const formattedAddress=tidy(f.place_name||[label,area,city,country==="ZW"?"Zimbabwe":"Malawi"].filter(Boolean).join(", "),500);
 return {lat,lng,city,area,country,label,formattedAddress};
}
export async function requestMapTiler(url,{origin="",fetcher=fetch}={}){
 const safe=new URL(url);
 if(safe.protocol!=="https:"||safe.hostname!=="api.maptiler.com"||
  !safe.pathname.startsWith("/geocoding/"))fail("Unsupported geocoding provider URL.");
 let response;
 try{
  const headers={"Accept":"application/json"};
  // MapTiler origin-restricted browser keys require the actual application's
  // origin on server-side forwarded requests. Never accept arbitrary origins.
  if(origin){
   const o=new URL(origin);
   if(o.protocol==="https:"&&(o.hostname==="spotlyafrica.com"||o.hostname==="www.spotlyafrica.com"||
      /^[a-z0-9-]+\.vercel\.app$/i.test(o.hostname)))headers.Origin=o.origin;
  }
  response=await fetcher(safe.toString(),{headers,signal:AbortSignal.timeout(5500),cache:"no-store"});
 }catch{fail("MapTiler location service could not be reached.");}
 if(response.status===401||response.status===403)
  fail("MapTiler location access was rejected. Check key permissions and allowed website origins.");
 if(response.status===429)fail("MapTiler location quota or rate limit was reached. Try later.");
 if(!response.ok)fail("MapTiler location search is temporarily unavailable.");
 let data;try{data=await response.json();}catch{fail("MapTiler returned invalid location data.");}
 if(!Array.isArray(data?.features))fail("MapTiler returned an unexpected location response.");
 return data;
}
