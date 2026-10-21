/** Verified road routing for SpotlyRide and SpotlySend.
 * MapMap speaks OSRM GET /route/v1/driving/{lon,lat;lon,lat}
 * and requires a server-side Authorization: Bearer snk_... header.
 * No provider secrets, error bodies or query-key URLs are returned to clients.
 */
const fail=(message,status=503)=>{throw Object.assign(new Error(message),{status});};
const closeTo=(a,b)=>{ // short haversine in km, also used for endpoint snap safety
 const rad=Math.PI/180,latA=Number(a.lat)*rad,latB=Number(b.lat)*rad;
 const dLat=(Number(b.lat)-Number(a.lat))*rad,dLng=(Number(b.lng)-Number(a.lng))*rad;
 const h=Math.sin(dLat/2)**2+Math.cos(latA)*Math.cos(latB)*Math.sin(dLng/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.max(0,h))));
};
const validPoint=p=>p?.lat!=null&&p?.lng!=null&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&
 Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180;
const tokenPattern=/^snk_[A-Za-z0-9_-]{16,180}$/;

export function routingConfiguration({endpoint=process.env.SPOTLY_ROUTING_URL,apiKey=process.env.SPOTLY_ROUTING_API_KEY}={}){
 if(!endpoint)return {ready:false,provider:"unconfigured",authenticated:false,reason:"Road-routing provider URL is missing."};
 let url;
 try{url=new URL(endpoint);}catch{return {ready:false,provider:"invalid",authenticated:false,reason:"Road-routing provider URL is invalid."}}
 const mapmap=url.hostname.toLowerCase()==="api.mapmap.ai";
 const provider=mapmap?"MapMap":"OSRM-compatible";
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||
    (mapmap&&url.pathname!=="/")||
    ["localhost","127.0.0.1","::1","router.project-osrm.org"].includes(url.hostname.toLowerCase()))
  return {ready:false,provider,authenticated:false,reason:"Use a trusted licensed HTTPS routing base URL, without paths, credentials or query parameters for MapMap."};
 if(mapmap&&(!apiKey||!tokenPattern.test(apiKey.trim())))
  return {ready:false,provider,authenticated:false,reason:"MapMap API key is missing or invalid in SPOTLY_ROUTING_API_KEY."};
 return {ready:true,provider,authenticated:mapmap,reason:""};
}

export function routeEndpoint(from,to,base=process.env.SPOTLY_ROUTING_URL,apiKey=process.env.SPOTLY_ROUTING_API_KEY){
 const conf=routingConfiguration({endpoint:base,apiKey});
 if(!conf.ready)fail(conf.reason);
 if(!validPoint(from)||!validPoint(to))fail("Pickup and destination have invalid GPS coordinates.",400);
 if(closeTo(from,to)<0.15)fail("Select two different locations at least 150 metres apart.",400);
 const url=new URL(base);
 const path=url.pathname.replace(/\/$/,"");
 const coordinates=[from,to].map(p=>Number(p.lng).toFixed(6)+","+Number(p.lat).toFixed(6)).join(";");
 url.pathname=path+"/route/v1/driving/"+coordinates;
 url.searchParams.set("overview","simplified");
 url.searchParams.set("geometries","geojson");
 url.searchParams.set("steps","false");
 return url.toString();
}

export async function getVerifiedRideRoute(from,to,{
 endpoint=process.env.SPOTLY_ROUTING_URL,
 apiKey=process.env.SPOTLY_ROUTING_API_KEY,
 fetcher=fetch
}={}){
 const config=routingConfiguration({endpoint,apiKey});
 if(!config.ready)fail(config.reason);
 const url=routeEndpoint(from,to,endpoint,apiKey);
 const headers={"Accept":"application/json"};
 // Only send Spotly's secret to the explicitly approved MapMap gateway.
 // Custom OSRM endpoints use their own routing service authentication.
 if(config.provider==="MapMap")headers.Authorization="Bearer "+apiKey.trim();
 let response;
 try{
  response=await fetcher(url,{headers,signal:AbortSignal.timeout(8500),cache:"no-store",redirect:"error"});
 }catch{fail("Road-routing provider could not be reached. Please try again.");}
 if(response.status===401||response.status===403)
  fail("Routing access was rejected. Verify the MapMap API key and provider permissions.");
 if(response.status===402||response.status===429)
  fail("Routing provider quota, credits or rate limit reached. Check your provider plan.");
 if(response.status>=500)fail("Routing provider is temporarily unavailable.");
 if(!response.ok)fail("No safe driving route was returned for these locations.",409);
 let data;
 try{data=await response.json();}catch{fail("Routing provider returned unreadable route data.");}
 const route=data?.routes?.[0],distance=Number(route?.distance),duration=Number(route?.duration);
 if(data?.code!=="Ok"||!Number.isFinite(distance)||distance<150||
    distance>1500000||!Number.isFinite(duration)||duration<=0||duration>604800)
  fail("No safe drivable route was confirmed.",409);
 const raw=route?.geometry?.coordinates;
 if(!Array.isArray(raw)||raw.length<2)
  fail("Routing provider did not return usable road geometry.");
 const points=raw.map(p=>({
  lng:Number(p?.[0]),lat:Number(p?.[1])
 }));
 if(points.some(p=>!validPoint(p)))
  fail("Routing provider returned invalid road geometry.");
 // Reject results snapped many kilometres away from the chosen pin.
 // A snapped route is needed, not a valid route somewhere else.
 if(closeTo(from,points[0])>3||closeTo(to,points.at(-1))>3)
  fail("Could not match both locations to nearby drivable roads.",409);
 const stride=Math.max(1,Math.ceil(points.length/100));
 const path=points.filter((_,i)=>i%stride===0||i===points.length-1);
 return {distanceKm:Number((distance/1000).toFixed(2)),
  durationMinutes:Math.max(1,Math.ceil(duration/60)),
  source:"verified_road_route",path};
}
