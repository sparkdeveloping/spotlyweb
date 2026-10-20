/** A licensed/operated OSRM-compatible endpoint is required before launching routed Ride pricing. */
const fail=(msg,status=503)=>{throw Object.assign(new Error(msg),{status})};
export function routeEndpoint(from,to,base=process.env.SPOTLY_ROUTING_URL){
 if(!base)fail("Verified Ride routing is not configured.");
 let url;
 try{url=new URL(base);}catch{fail("Ride routing configuration is invalid.");}
 if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash)
  fail("Ride routing must use a trusted HTTPS endpoint.");
 const coordinates=[from,to].map(p=>[Number(p.lng),Number(p.lat)].map(x=>x.toFixed(6)).join(",")).join(";");
 const path=url.pathname.replace(/\/$/,"");
 url.pathname=path+"/route/v1/driving/"+coordinates;
 url.searchParams.set("overview","simplified");
 url.searchParams.set("geometries","geojson");
 url.searchParams.set("steps","false");
 return url.toString();
}
export async function getVerifiedRideRoute(from,to,{endpoint=process.env.SPOTLY_ROUTING_URL,fetcher=fetch}={}){
 const url=routeEndpoint(from,to,endpoint);
 let response;
 try{response=await fetcher(url,{headers:{"Accept":"application/json"},signal:AbortSignal.timeout(6000),cache:"no-store"});}
 catch{fail("Verified Ride routing is temporarily unavailable.");}
 if(!response.ok)fail("Ride routing provider is unavailable.");
 const data=await response.json();
 const route=data.routes?.[0],distance=Number(route?.distance),duration=Number(route?.duration);
 if(data.code!=="Ok"||!Number.isFinite(distance)||distance<150||!Number.isFinite(duration)||duration<=0)
  fail("No safe drivable route was confirmed.",409);
 const original=Array.isArray(route.geometry?.coordinates)?route.geometry.coordinates:[];
 const stride=Math.max(1,Math.ceil(original.length/100));
 const polyline=original.filter((_,i)=>i%stride===0||i===original.length-1)
  .filter(p=>Array.isArray(p)&&p.length>=2).map(p=>({lat:Number(p[1]),lng:Number(p[0])}));
 return {distanceKm:Number((distance/1000).toFixed(2)),durationMinutes:Math.max(1,Math.ceil(duration/60)),
  source:"verified_road_route",path:polyline};
}
