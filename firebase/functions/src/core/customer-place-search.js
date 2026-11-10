import { HttpsError } from "firebase-functions/v2/https";

// Native customer place search. Keep provider secrets on the trusted Firebase
// side; unlike Apple's MKLocalSearch, this supports explicit named-POI search.
const bounds = { ZW: [-22.5,-15.5,25,34], MW: [-17.25,-9.2,32.6,36.1] };
const tidy = (value, max = 200) => String(value ?? "").trim().slice(0,max);
const norm = (value) => tidy(value,300).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function within(point,country) {
  const b=bounds[country];
  return !!b&&point&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&point.lat>=b[0]&&point.lat<=b[1]&&point.lng>=b[2]&&point.lng<=b[3];
}
function featureTypes(row) {
  return [...(Array.isArray(row?.place_type)?row.place_type:[]), tidy(row?.properties?.place_designation),
    tidy(row?.id).split(".")[0]].map(v=>v.toLowerCase());
}
const hasType=(row,types)=>types.some(type=>featureTypes(row).includes(type));
const context=(row)=>Array.isArray(row?.context)?row.context:[];
const contextName=(row,types)=>tidy([row,...context(row)].find(entry=>hasType(entry,types))?.text,120);
function normalizedCountry(row) {
  const values=[row,...context(row)].flatMap(entry=>[entry?.country_code,entry?.properties?.country_code]);
  return values.map(v=>tidy(v,3).toUpperCase()).find(v=>v==="ZW"||v==="MW")||"";
}
function matchingName(row,query){
  const input=norm(query);
  const names=[row?.text,row?.matching_text,row?.address].map(norm);
  return names.some(v=>v.includes(input))||
    input.split(/\s+/).filter(Boolean).length>1&&
    input.split(/\s+/).filter(Boolean).every(word=>names.some(v=>v.includes(word)));
}
export function mapTilerSearchUrl({query,country,center,apiKey}){
  const input=tidy(query,140);
  if(!bounds[country])throw new HttpsError("invalid-argument","Select Zimbabwe or Malawi.");
  if(input.length<2)throw new HttpsError("invalid-argument","Enter at least two characters.");
  if(!/^[A-Za-z0-9_-]{16,180}$/.test(tidy(apiKey,180)))
    throw new HttpsError("unavailable","Licensed location search is not configured.");
  const url=new URL("https://api.maptiler.com/geocoding/"+encodeURIComponent(input)+".json");
  url.searchParams.set("key",apiKey);
  url.searchParams.set("country",country.toLowerCase());
  url.searchParams.set("language","en");
  url.searchParams.set("types","poi,address,road,municipality,locality");
  url.searchParams.set("autocomplete","true");
  url.searchParams.set("limit","10");
  if(within(center,country)){
    url.searchParams.set("proximity",center.lng.toFixed(5)+","+center.lat.toFixed(5));
    const b=bounds[country];
    const bbox=[Math.max(b[2],center.lng-0.75),Math.max(b[0],center.lat-0.65),
      Math.min(b[3],center.lng+0.75),Math.min(b[1],center.lat+0.65)];
    url.searchParams.set("bbox",bbox.map(n=>n.toFixed(5)).join(","));
  }
  return url;
}
export function normalizeMapTilerSuggestions(body,{query,country,city}){
  if(!bounds[country])return [];
  const seen=new Set();
  return (Array.isArray(body?.features)?body.features:[]).flatMap(row=>{
    const coords=Array.isArray(row?.center)?row.center:row?.geometry?.coordinates;
    const point={lat:Number(coords?.[1]),lng:Number(coords?.[0])};
    if(!within(point,country))return [];
    const foundCountry=normalizedCountry(row);
    if(foundCountry&&foundCountry!==country)return [];
    if(!matchingName(row,query))return [];
    const relevance=Number(row?.relevance??0);
    if(!Number.isFinite(relevance)||relevance<0.5)return [];
    const name=tidy(row?.text||row?.matching_text||row?.place_name,180);
    const label=tidy(row?.place_name||name,300);
    if(!name||!label)return [];
    const foundCity=contextName(row,["municipality","city","town","village"])||tidy(city,120);
    const area=contextName(row,["neighbourhood","suburb","quarter","district","locality"]);
    const dedup=Math.round(point.lat*100000)+"_"+Math.round(point.lng*100000)+"_"+norm(name);
    if(seen.has(dedup))return [];seen.add(dedup);
    return [{id:"maptiler:"+(tidy(row?.id,150)||dedup),label,lat:point.lat,lng:point.lng,
      area:norm(area)===norm(foundCity)?null:(area||null),
      city:foundCity,country,provider:"maptiler",relevance}];
  }).sort((a,b)=>b.relevance-a.relevance).slice(0,8).map(({relevance,...row})=>row);
}
export async function searchCustomerPlaces({data={},apiKey=process.env.SPOTLY_MAPTILER_GEOCODING_KEY,fetcher=fetch}){
  const country=tidy(data.country,2).toUpperCase();
  const query=tidy(data.query,140),city=tidy(data.city,120);
  if(!bounds[country])throw new HttpsError("invalid-argument","Choose Zimbabwe or Malawi.");
  if(query.length<2)return {ok:true,results:[]};
  const center=data.center?{lat:Number(data.center.lat),lng:Number(data.center.lng)}:null;
  const url=mapTilerSearchUrl({query,country,center,apiKey});
  let response;
  try{response=await fetcher(url.toString(),{headers:{Accept:"application/json"},
      signal:AbortSignal.timeout(6500),redirect:"error"});}
  catch{throw new HttpsError("unavailable","Location search could not connect. Please retry.");}
  if(response.status===429)throw new HttpsError("resource-exhausted","Location search is busy. Please retry.");
  if(!response.ok)throw new HttpsError("unavailable","Location search is currently unavailable.");
  let body;try{body=await response.json();}
  catch{throw new HttpsError("unavailable","The location provider returned an invalid response.");}
  return {ok:true,results:normalizeMapTilerSuggestions(body,{query,country,city})};
}
