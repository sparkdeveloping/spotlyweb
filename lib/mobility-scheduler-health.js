import {FieldValue} from "firebase-admin/firestore";
/** Scheduler health is earned only through recurring signed endpoint executions. */
export function dispatchHealth(record={},now=Date.now()){
 const last=record.lastTickAt?.toMillis?.()||record.lastTickAtMs||0;
 const consecutive=Number(record.consecutive||0);
 const ageMs=last?Math.max(0,now-last):null;
 return {ready:ageMs!==null&&ageMs<=210000&&consecutive>=3&&Number(record.failed||0)===0,
  lastTickAt:last?new Date(last).toISOString():null,
  ageSeconds:ageMs===null?null:Math.round(ageMs/1000),
  consecutive,failed:Number(record.failed||0)};
}
export async function recordDispatchHeartbeat(db,service,{checked=0,failed=0}={}){
 if(!["ride","send"].includes(service))throw Error("Unknown mobility scheduler.");
 const ref=db.collection("mobilityDispatchHealth").doc(service);
 await db.runTransaction(async tx=>{
  const old=await tx.get(ref),data=old.exists?old.data():{};
  const prev=data.lastTickAt?.toMillis?.()||0;
  const elapsed=Date.now()-prev;
  const consecutive=prev&&elapsed>=20000&&elapsed<=240000?
   Math.min(1000,Number(data.consecutive||0)+1):1;
  const now=FieldValue.serverTimestamp();
  tx.set(ref,{service,lastTickAt:now,consecutive,checked:Number(checked)||0,
   failed:Number(failed)||0,lastResult:failed?"partial_failures":"completed",
   updatedAt:now},{merge:true});
 });
}
