import { createHash } from "node:crypto";

// Canonical body fingerprint binds an idempotency key to exactly one request.
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")
    return Object.fromEntries(Object.keys(value).filter(key=>value[key]!==undefined)
      .sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export function mobilityRequestFingerprint(body){
  const payload={...body};delete payload.idempotencyKey;
  return createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
}
export function mobilityRequestReferences(db,uid,service,key){
  const scope=createHash("sha256").update(service+"\0"+uid).digest("hex");
  const request=key?createHash("sha256").update(service+"\0"+uid+"\0"+key).digest("hex"):null;
  return {requestRef:request?db.collection("customerMobilityRequests").doc(request):null,
    activeRef:db.collection("customerMobilityActiveRequests").doc(scope)};
}
export function requireMatchingReplay(snapshot,fingerprint){
  if(!snapshot?.exists)return null;
  const stored=snapshot.data();
  if(stored.fingerprint!==fingerprint||!stored.response)
    throw Object.assign(new Error("This request identifier was already used with different details. Check Activity before submitting another request."),{status:409});
  return stored.response;
}
export function liveMobilityState(state,service){
  const terminal=service==="ride"?["completed","cancelled","failed","rejected","expired"]:
    ["delivered","cancelled","failed","returned","rejected","expired"];
  return !terminal.includes(String(state||"").toLowerCase());
}
