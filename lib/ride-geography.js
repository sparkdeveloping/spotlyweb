/** Conservative country envelopes; not a substitute for surveyed launch geofences. */
export const RIDE_COUNTRY_BOUNDS=Object.freeze({
 ZW:{minLat:-22.6,maxLat:-15.55,minLng:25.15,maxLng:33.15,name:"Zimbabwe"},
 MW:{minLat:-17.18,maxLat:-9.30,minLng:32.60,maxLng:36.48,name:"Malawi"}
});
const fail=(text)=>{throw Object.assign(new Error(text),{status:409})};
export function insideCountryBounds(point,country){
 const b=RIDE_COUNTRY_BOUNDS[country],lat=Number(point?.lat),lng=Number(point?.lng);
 return !!b&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=b.minLat&&lat<=b.maxLat&&lng>=b.minLng&&lng<=b.maxLng;
}
export function validatedRideCountry(point,declaredCountry){
 const country=String(point?.country||declaredCountry||"").trim().toUpperCase();
 if(!insideCountryBounds(point,country))fail("Pickup or destination is outside the supported country boundary.");
 return country;
}
export function validateRideTerritory(pickup,dropoff,mobility={}){
 const country=validatedRideCountry(pickup);
 if(validatedRideCountry(dropoff)!==country)fail("Cross-border Ride requests are not supported.");
 const countries=Array.isArray(mobility.enabledCountries)?mobility.enabledCountries:[];
 if(!countries.includes(country))fail("Spotly Ride is not approved for this country.");
 const cities=Array.isArray(mobility.enabledCities)?mobility.enabledCities:[];
 const city=String(pickup?.city||"").trim().toLowerCase();
 if(!city||!cities.some(c=>String(c).trim().toLowerCase()===city))fail("Ride is not yet approved for this pickup city.");
 const fences=mobility.cityGeofences||{};
 const fence=fences[country+":"+city]||fences[city]||
   Object.entries(fences).find(([name])=>name.toLowerCase()===country+":"+city)?.[1];
 if(!fence||String(fence.country||"").toUpperCase()!==country||
    !insideCountryBounds(fence,country))
  fail("This city has no verified Spotly Ride geofence.");
 const rad=Math.PI/180,a1=Number(pickup.lat)*rad,a2=Number(fence.lat)*rad;
 const d1=(Number(fence.lat)-Number(pickup.lat))*rad;
 const d2=(Number(fence.lng)-Number(pickup.lng))*rad;
 const h=Math.sin(d1/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(d2/2)**2;
 const distance=6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
 if(!Number.isFinite(distance)||distance>Math.min(100,Math.max(3,Number(fence.radiusKm)||0)))
  fail("Your pickup is outside this city's approved Ride service zone.");
 const allowed=mobility.enabledAreas?.[pickup.city]||
  Object.entries(mobility.enabledAreas||{}).find(([c])=>c.toLowerCase()===city)?.[1];
 if(Array.isArray(allowed)&&allowed.length&&!allowed.some(a=>a.toLowerCase()===String(pickup.area||"").toLowerCase()))
  fail("Ride is not available in this pickup area.");
 return {country,city};
}
