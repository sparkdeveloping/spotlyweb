import {createHash,timingSafeEqual} from "node:crypto";
/** No merchant deliveryJobs or merchant purchase orders participate in this model. */
const fail=m=>{throw Object.assign(new Error(m),{status:409})};
export function cost(items=[]){
 let cents=0;
 for(const x of items){
  if(["pending","substitution_pending"].includes(x.status))fail("Every requested item needs a documented outcome.");
  if(["unavailable","removed"].includes(x.status))continue;
  if(!["found","substituted"].includes(x.status))fail("Unknown item outcome.");
  const n=x.actualQuantity,p=x.actualUnitPrice;
  if(!Number.isInteger(n)||n<1||n>20||typeof p!=="number"||!Number.isFinite(p)||p<0||p>100000)fail("Invalid item quantity or unit price.");
  if(Math.abs(p*100-Math.round(p*100))>0.000001)fail("Prices must use two decimal places.");
  cents+=n*Math.round(p*100);
 }
 return cents/100;
}
export function pinHash(requestId,pin){return createHash("sha256").update(String(requestId)+"|"+String(pin)).digest("hex")}
export function matchesPin(requestId,pin,expected){
 if(!/^\d{6}$/.test(String(pin))||!/^[a-f0-9]{64}$/.test(String(expected||"")))return false;
 return timingSafeEqual(Buffer.from(pinHash(requestId,pin),"hex"),Buffer.from(expected,"hex"));
}
export function canShop(record={},settings={},float={}) {
 return record.state==="funded_awaiting_shopper"&&record.paymentStatus==="paid_held"&&
  settings.assistFinance?.driverDispatchEnabled===true&&float.status==="externally_confirmed"&&
  float.requestId===record.id&&float.currency==="USD"&&float.amount>=record.finalQuote?.merchandiseTotal;
}
