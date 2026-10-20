import {insideCountryBounds} from "./ride-geography.js";
const fail=reason=>{throw Object.assign(new Error(reason),{status:409})};
const rad=Math.PI/180;
export function validateSendTerritory(pickup,dropoff,config={}){
 // First controlled launch is Zimbabwe. Malawi supports Ride, not Send.
 if(!insideCountryBounds(pickup,"ZW")||!insideCountryBounds(dropoff,"ZW")||
   String(pickup?.country||"").toUpperCase()!=="ZW"||
   String(dropoff?.country||"").toUpperCase()!=="ZW")
  fail("SpotlySend currently supports domestic Zimbabwe deliveries only.");
 const city=String(pickup?.city||"").trim().toLowerCase();
 const cities=Array.isArray(config.enabledCities)?config.enabledCities:[];
 if(!city||!cities.some(c=>String(c).toLowerCase()===city))fail("SpotlySend is not yet approved for this city.");
 const fence=config.cityGeofences?.["ZW:"+city];
 if(!fence||String(fence.country||"").toUpperCase()!=="ZW"||!insideCountryBounds(fence,"ZW"))
  fail("This Send pickup city has no approved service geofence.");
 const lat=Number(pickup.lat)*rad,fl=Number(fence.lat)*rad;
 const dlat=(Number(fence.lat)-Number(pickup.lat))*rad,dlng=(Number(fence.lng)-Number(pickup.lng))*rad;
 const hav=Math.sin(dlat/2)**2+Math.cos(lat)*Math.cos(fl)*Math.sin(dlng/2)**2;
 const distance=6371*2*Math.asin(Math.min(1,Math.sqrt(hav))),radius=Number(fence.radiusKm);
 if(!Number.isFinite(radius)||radius<3||radius>100||!Number.isFinite(distance)||distance>radius)
  fail("Send pickup is outside the approved delivery coverage zone.");
 const allowed=Object.entries(config.enabledAreas||{}).find(([name])=>name.toLowerCase()===city)?.[1];
 if(Array.isArray(allowed)&&allowed.length&&!allowed.some(x=>x.toLowerCase()===String(pickup.area||"").toLowerCase()))
  fail("Send pickup is not approved in this area.");
 return {country:"ZW",city};
}
