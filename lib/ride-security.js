import {createCipheriv,createDecipheriv,createHash,randomBytes,randomInt,timingSafeEqual} from "node:crypto";
/** Only trusted server routes can access encrypted customer pickup secrets. */
const key=secret=>{
 if(typeof secret!=="string"||secret.length<32)throw Object.assign(new Error("Ride pickup PIN encryption is not configured."),{status:503});
 return createHash("sha256").update("spotly:ride:pickup-pin:v1:"+secret).digest();
};
export function newRidePin(){return String(randomInt(100000,1000000));}
export function sealRidePin(pin,secret=process.env.SPOTLY_RIDE_PIN_KEY){
 if(!/^[0-9]{6}$/.test(pin))throw Error("A 6-digit pickup code is required.");
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(secret),iv);
 const encrypted=Buffer.concat([cipher.update(pin,"utf8"),cipher.final()]);
 return ["v1",iv.toString("hex"),cipher.getAuthTag().toString("hex"),encrypted.toString("hex")].join(".");
}
export function revealRidePin(ride,secret=process.env.SPOTLY_RIDE_PIN_KEY){
 if(!ride?.pickupPinCiphertext)return typeof ride?.pickupPin==="string"?ride.pickupPin:null; // existing trips only
 const [version,iv,tag,payload]=ride.pickupPinCiphertext.split(".");
 if(version!=="v1"||!iv||!tag||!payload)throw Error("Unknown pickup PIN encoding.");
 const decipher=createDecipheriv("aes-256-gcm",key(secret),Buffer.from(iv,"hex"));
 decipher.setAuthTag(Buffer.from(tag,"hex"));
 return Buffer.concat([decipher.update(Buffer.from(payload,"hex")),decipher.final()]).toString("utf8");
}
export function matchesRidePin(ride,value,secret=process.env.SPOTLY_RIDE_PIN_KEY){
 if(!/^[0-9]{4,6}$/.test(String(value||"")))return false;
 const actual=revealRidePin(ride,secret);
 if(!actual||actual.length!==String(value).length)return false;
 return timingSafeEqual(Buffer.from(actual),Buffer.from(String(value)));
}
