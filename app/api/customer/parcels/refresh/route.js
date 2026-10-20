import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {authenticateRequest,apiError,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
import {dispatchParcel} from "@/lib/parcel-server";
export const runtime="nodejs";
const schema=z.object({parcelJobId:z.string().min(3).max(180)}).strict();
export async function POST(request){
 try{
  const user=await authenticateRequest(request);
  await enforceRateLimit(request,{key:"send_customer_dispatch_refresh",limit:30,windowMs:600000,identity:user.uid});
  const body=schema.parse(await request.json()),{db,messaging}=getAdminServices();
  const ref=db.collection("parcelJobs").doc(body.parcelJobId);
  const snap=await ref.get();
  if(!snap.exists||snap.data().customerId!==user.uid)
   throw Object.assign(new Error("The Send request was not found."),{status:404});
  const parcel=snap.data();
  if(parcel.state==="scheduled"){
    const schedule=parcel.scheduledPickupAt?.toMillis?.()||0;
    if(schedule&&schedule<=Date.now()+15*60_000){
     await db.runTransaction(async tx=>{
      const latest=await tx.get(ref);
      if(!latest.exists||latest.data().state!=="scheduled")return;
      const now=FieldValue.serverTimestamp();
      tx.update(ref,{state:"searching_driver",dispatchAttemptedAt:null,updatedAt:now});
      if(latest.data().orderId)tx.update(db.collection("orders").doc(latest.data().orderId),{
       sendStatus:"searching_driver",status:"requested",updatedAt:now});
      tx.create(db.collection("parcelEvents").doc(),{
       parcelJobId:body.parcelJobId,type:"dispatch.scheduled_due",actorType:"system",
       actorId:"customer_scheduled_refresh",state:"searching_driver",createdAt:now});
     });
    }else return Response.json({ok:true,scheduled:true,skipped:true});
  }else if(!["requested","searching_driver"].includes(parcel.state))
   return Response.json({ok:true,state:parcel.state,skipped:true});
  const current=await ref.get(),recent=current.data()?.dispatchAttemptedAt?.toMillis?.()||0;
  if(Date.now()-recent<45000)return Response.json({ok:true,skipped:true});
  const result=await dispatchParcel({db,messaging,parcelJobId:body.parcelJobId,actorId:"customer_send_refresh"});
  return Response.json({ok:true,dispatch:result});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Select an active Send request."},{status:422});
  return apiError(error);
 }
}
