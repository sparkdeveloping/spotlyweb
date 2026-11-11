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
const MAX_ACCESS_METERS=350;
const CONFIRM_ACCESS_METERS=35;
const accessDistance=(a,b)=>closeTo(a,b)*1000;
const pairPoint=p=>Array.isArray(p)&&p.length>=2&&p[0]!=null&&p[1]!=null
 ?{lat:Number(p[1]),lng:Number(p[0])}:null;


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
 if(conf.provider==="MapMap")url.searchParams.set("snap_retry","false");
 else url.searchParams.set("radiuses",MAX_ACCESS_METERS+";"+MAX_ACCESS_METERS);
 return url.toString();
}

// Both the route geometry and its proposed curb points are verified on the
// server, with the same 350m access policy as the Firebase quote service.
export function interpretVerifiedRoute(data,from,to){
 const r=data?.routes?.[0],distance=Number(r?.distance),duration=Number(r?.duration);
 if(data?.code!=="Ok"||!Number.isFinite(distance)||distance<150||distance>1500000||
    !Number.isFinite(duration)||duration<=0||duration>604800)return null;
 const raw=r?.geometry?.coordinates;
 if(!Array.isArray(raw)||raw.length<2||raw.length>50000)return null;
 const points=raw.map(pairPoint);
 if(points.some(p=>!validPoint(p)))return null;
 const access=(intent,waypoint,fallback)=>{
  const location=pairPoint(waypoint?.location)||fallback;
  if(!validPoint(location))return null;
  const meters=accessDistance(intent,location);
  if(!Number.isFinite(meters)||meters>MAX_ACCESS_METERS)return null;
  return {lat:Number(location.lat.toFixed(6)),lng:Number(location.lng.toFixed(6)),
    distanceMeters:Math.round(meters),roadName:String(waypoint?.name||"").trim().slice(0,100)||null,
    requiresConfirmation:meters>=CONFIRM_ACCESS_METERS};
 };
 const pickup=access(from,data?.waypoints?.[0],points[0]);
 const destination=access(to,data?.waypoints?.[1],points.at(-1));
 if(!pickup||!destination||accessDistance(points[0],pickup)>125||
    accessDistance(points.at(-1),destination)>125)return null;
 const stride=Math.max(1,Math.ceil(points.length/110));
 const path=points.filter((_,i)=>i%stride===0||i===points.length-1);
 return {distanceKm:Number((distance/1000).toFixed(2)),
   durationMinutes:Math.max(1,Math.ceil(duration/60)),
   source:"verified_road_route",path,accessPoints:{pickup,destination}};
}

export function assertRoadAccessConsent(route,consent){
 const access=route?.accessPoints;
 if(!access?.pickup||!access?.destination)fail("Road access could not be verified for this request.",409);
 const mustConfirm=access.pickup.requiresConfirmation||access.destination.requiresConfirmation;
 if(!consent&&!mustConfirm)return false;
 if(consent?.acknowledged!==true||!validPoint(consent.pickup)||!validPoint(consent.destination))
  fail("Confirm both proposed road access points before placing this request.",409);
 if(accessDistance(consent.pickup,access.pickup)>20||
    accessDistance(consent.destination,access.destination)>20)
  fail("Road access changed after your estimate. Review the updated route and confirm again.",409);
 return true;
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
 let data;
 try{data=await response.json();}catch{fail("Routing provider returned unreadable route data.");}
 if(data?.code==="NoRoute"||data?.code==="NoSegment")fail("No connected drivable route is available near these locations.",409);
 if(!response.ok||data?.code!=="Ok")fail("Routing provider rejected the route request or returned an invalid response.");
 const verified=interpretVerifiedRoute(data,from,to);
 if(!verified)fail("Could not verify nearby drivable access and road geometry for this route.",409);
 return verified;
}
