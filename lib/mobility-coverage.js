import {insideCountryBounds} from "./ride-geography.js";

export const MOBILITY_COUNTRIES=Object.freeze({ZW:"Zimbabwe",MW:"Malawi"});
export function normalizedCoverageKey(country,city){
 return String(country||"").trim().toUpperCase()+":"+String(city||"").trim().toLowerCase();
}
function error(message){throw Object.assign(new Error(message),{status:422});}
export function verifyCoverageZone({country,city,lat,lng,radiusKm},{
 enabledCities=[],enabledCountries=["ZW"],send=false
}={}){
 const c=String(country||"").trim().toUpperCase();
 const cityName=String(city||"").trim();
 const latitude=Number(lat),longitude=Number(lng),radius=Number(radiusKm);
 if(!Object.hasOwn(MOBILITY_COUNTRIES,c)||(send&&c!=="ZW"))
  error("Choose a supported country for the "+(send?"Send":"Ride")+" service area.");
 if(!enabledCountries.includes(c))error("Enable "+MOBILITY_COUNTRIES[c]+" before saving its coverage.");
 if(!cityName||cityName.length>120||!enabledCities.some(x=>String(x).trim().toLowerCase()===cityName.toLowerCase()))
  error("Add this city to Enabled cities before saving its coverage.");
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!insideCountryBounds({lat:latitude,lng:longitude},c))
  error("The coverage center must be a valid location inside "+MOBILITY_COUNTRIES[c]+".");
 if(!Number.isFinite(radius)||radius<3||radius>100)
  error("Choose a coverage radius from 3 to 100 km.");
 return {key:normalizedCoverageKey(c,cityName),
   value:{country:c,lat:Number(latitude.toFixed(6)),lng:Number(longitude.toFixed(6)),radiusKm:Number(radius.toFixed(1))}};
}
export function validateCoverageCollection(fences={},options={}){
 if(!fences||typeof fences!=="object"||Array.isArray(fences))error("Service coverage must be a collection of city zones.");
 if(Object.keys(fences).length>80)error("Too many service areas. Contact support to review a larger rollout.");
 const out={};
 for(const [key,zone] of Object.entries(fences)){
  const match=/^(ZW|MW):(.+)$/i.exec(key);
  if(!match)error("Service area names must match an enabled country and city.");
  const {key:canonical,value}=verifyCoverageZone({...zone,city:match[2]},options);
  if(canonical!==key||canonical in out)
   error("Duplicate or mismatched service areas were found. Review city names.");
  out[canonical]=value;
 }
 return out;
}
