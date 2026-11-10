import {insideCountryBounds} from "./ride-geography.js";
const fail=reason=>{throw Object.assign(new Error(reason),{status:409})};
const rad=Math.PI/180;
const code=value=>String(value||"").trim().toUpperCase();
const key=value=>String(value||"").trim().toLowerCase();

export function validateSendTerritory(pickup,dropoff,config={}){
 const country=code(pickup?.country),dropCountry=code(dropoff?.country);
 if(!country||country!==dropCountry)fail("Spotly Send supports domestic deliveries only. Pickup and drop-off must be in the same country.");
 const enabledCountries=Array.isArray(config.enabledCountries)?config.enabledCountries.map(code):[];
 if(!enabledCountries.includes(country))fail("Spotly Send is not enabled in this country yet.");
 if(!insideCountryBounds(pickup,country)||!insideCountryBounds(dropoff,country))
  fail("Pickup and drop-off must remain inside the selected Send country.");
 const city=key(pickup?.city);
 const dropCity=key(dropoff?.city);
 const cities=Array.isArray(config.enabledCities)?config.enabledCities.map(key):[];
 if(!city||!cities.includes(city))fail("Spotly Send is not yet approved for this pickup city.");
 if(dropCity&&!cities.includes(dropCity))fail("Spotly Send is not yet approved for this drop-off city.");
 const fence=config.cityGeofences?.[`${country}:${city}`];
 if(!fence||code(fence.country)!==country||!insideCountryBounds(fence,country))
  fail("This Send pickup city has no approved service geofence.");
 const lat=Number(pickup.lat)*rad,fl=Number(fence.lat)*rad;
 const dlat=(Number(fence.lat)-Number(pickup.lat))*rad,dlng=(Number(fence.lng)-Number(pickup.lng))*rad;
 const hav=Math.sin(dlat/2)**2+Math.cos(lat)*Math.cos(fl)*Math.sin(dlng/2)**2;
 const distance=6371*2*Math.asin(Math.min(1,Math.sqrt(hav))),radius=Number(fence.radiusKm);
 if(!Number.isFinite(radius)||radius<3||radius>100||!Number.isFinite(distance)||distance>radius)
  fail("Send pickup is outside the approved delivery coverage zone.");
 const areas=config.enabledAreas||{};
 const allowed=areas[`${country}:${city}`]||Object.entries(areas).find(([name])=>key(name)===city)?.[1];
 if(Array.isArray(allowed)&&allowed.length&&!allowed.some(x=>key(x)===key(pickup.area)))
  fail("Send pickup is not approved in this area.");
 return {country,city};
}
