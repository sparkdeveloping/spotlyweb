import {newRidePin,sealRidePin,revealRidePin,matchesRidePin} from "./ride-security.js";
const secret=()=>process.env.SPOTLY_SEND_PIN_KEY;
export function newParcelPin(){return newRidePin();}
export function sealParcelPin(pin){return sealRidePin(pin,secret());}
export function revealParcelPin(parcel,kind){
 const k=kind==="dropoff"?"dropoff":"pickup";
 return revealRidePin({pickupPinCiphertext:parcel?.[k+"PinCiphertext"],pickupPin:parcel?.[k+"Pin"]},secret());
}
export function matchesParcelPin(parcel,kind,value){
 const k=kind==="dropoff"?"dropoff":"pickup";
 return matchesRidePin({pickupPinCiphertext:parcel?.[k+"PinCiphertext"],pickupPin:parcel?.[k+"Pin"]},value,secret());
}
export function expectedParcelProofPath(driverId,parcelJobId){
 if(!/^[\w-]{3,180}$/.test(driverId)||!/^[\w-]{3,180}$/.test(parcelJobId))
  throw Object.assign(new Error("Invalid Send proof identity."),{status:422});
 return "driver-send-proof/"+driverId+"/"+parcelJobId+"/";
}
