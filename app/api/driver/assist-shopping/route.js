import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {cost,matchesPin} from "@/lib/assist-fulfillment";
export const runtime="nodejs";
const schema=z.object({
 requestId:z.string().min(12).max(250),action:z.enum(["accept","reject","start","item","propose_substitution","receipt","en_route","complete"]),
 itemId:z.string().max(180).optional(),itemStatus:z.enum(["found","unavailable"]).optional(),
 actualQuantity:z.number().int().min(0).max(20).optional(),actualUnitPrice:z.number().finite().min(0).max(100000).optional(),
 replacementName:z.string().trim().max(180).optional(),pin:z.string().regex(/^\d{6}$/).optional(),
 note:z.string().trim().max(500).default("")
}).strict();
const fail=(m,status=409)=>{throw Object.assign(new Error(m),{status})};
export async function GET(request){
 try{
  const user=await authenticateRequest(request),{db}=getAdminServices();
  const jobs=await db.collection("assistIndependentShoppingJobs").where("driverId","==",user.uid).limit(30).get();
  return Response.json({ok:true,jobs:jobs.docs.map(s=>({id:s.id,requestId:s.data().requestId,storeName:s.data().storeName,
    state:s.data().state,authorizedSpend:s.data().authorizedSpend,currency:"USD",items:s.data().items,
    storeAddress:s.data().storeAddress||"",deliveryAddress:s.data().deliveryAddress||"",contactPhone:s.data().contactPhone||"",
    actualSpend:s.data().actualSpend??null,updatedAt:s.data().updatedAt?.toDate?.()?.toISOString?.()||null}))},
    {headers:{"Cache-Control":"private, no-store"}});
 }catch(e){return apiError(e)}
}
export async function POST(request){
 try{
  const user=await authenticateRequest(request),input=schema.parse(await request.json());
  const {db}=getAdminServices(),jobRef=db.collection("assistIndependentShoppingJobs").doc(input.requestId),
    reqRef=db.collection("independentShoppingRequests").doc(input.requestId);
  let state;
  await db.runTransaction(async tx=>{
   const [job,req,upload]=await Promise.all([
     tx.get(jobRef),tx.get(reqRef),input.action==="receipt"?tx.get(db.collection("assistReceiptUploads").doc(input.requestId)):Promise.resolve(null)]);
   if(!job.exists||job.data().driverId!==user.uid)fail("This independent shopping job is not assigned to you.",403);
   if(!req.exists||req.data().paymentStatus!=="paid_held")fail("The customer funds are not confirmed. Do not purchase anything.");
   const j=job.data(),q=req.data(),now=FieldValue.serverTimestamp();
   const items=(j.items||[]).map(x=>({...x}));
   if(["accept","start"].includes(input.action)){
     const [settings,driver,application,presence]=await Promise.all([
       tx.get(db.collection("platformSettings").doc("global")),
       tx.get(db.collection("drivers").doc(user.uid)),
       tx.get(db.collection("driverApplications").doc(user.uid)),
       tx.get(db.collection("driverPresence").doc(user.uid))
     ]);
     if(settings.data()?.assistFinance?.driverDispatchEnabled!==true)
       fail("Independent shopper dispatch has been paused by Operations.");
     if(!driver.exists||driver.data().status==="suspended"||
        !application.exists||!["approved","ready","active"].includes(String(application.data().status||"")))
       fail("Your Driver authorization must be reviewed before shopping.",403);
     if(!presence.exists||presence.data().online!==true||presence.data().currentJobId!==jobRef.id)
       fail("Go online with your assigned shopping job before accepting or starting.");
   }
   if(input.action==="accept"||input.action==="reject"){
     if(j.state!=="assigned")fail("This shopper offer is no longer awaiting your answer.");
     state=input.action==="accept"?"accepted":"rejected";
     if(state==="rejected"){
       const presenceRef=db.collection("driverPresence").doc(user.uid);
       const presence=await tx.get(presenceRef);
       if(presence.exists&&presence.data().currentJobId===jobRef.id)
         tx.update(presenceRef,{currentJobId:FieldValue.delete(),currentWorkType:FieldValue.delete(),updatedAt:now});
     }
     tx.update(jobRef,{state,respondedAt:now,updatedAt:now,...(state==="rejected"?{rejectionNote:input.note}:{})});
     tx.update(reqRef,{state:state==="rejected"?"funded_awaiting_shopper":"shopper_assigned",
       dispatchStatus:state==="rejected"?"not_dispatched":"shopper_assigned",
       customerMessage:state==="rejected"?"Your shopper was unavailable. Spotly is arranging another authorized shopper.":"Your shopper accepted the assignment. No items have been purchased yet.",
       ...(state==="rejected"?{customerDeliveryPin:FieldValue.delete()}:{}),updatedAt:now});
     tx.create(db.collection("assistShoppingEvents").doc(),{
       requestId:input.requestId,driverId:user.uid,actorId:user.uid,action:input.action,state,createdAt:now});
     return;
   }
   if(input.action==="start"){
     if(j.state!=="accepted")fail("Accept this shopping assignment before starting work.");
     state="shopping";
   }else if(input.action==="item"||input.action==="propose_substitution"){
     if(j.state!=="shopping")fail("Items cannot be changed outside active shopping.");
     const row=items.find(x=>x.itemId===input.itemId);
     if(!row)fail("This item is not in the authorized basket.");
     if(input.action==="item"){
       if(!input.itemStatus||!["pending","found","unavailable"].includes(row.status))fail("This item is awaiting a customer decision.");
       const quantity=input.itemStatus==="unavailable"?0:input.actualQuantity;
       const price=input.itemStatus==="unavailable"?0:input.actualUnitPrice;
       if(input.itemStatus==="found"&&(!Number.isInteger(quantity)||quantity<1||quantity>row.quantity||typeof price!=="number"))fail("Confirm the quantity and actual shelf price.");
       row.status=input.itemStatus;row.actualQuantity=quantity;row.actualUnitPrice=price;
       const provisional=items.map(i=>["pending","substitution_pending"].includes(i.status)?{...i,status:"unavailable"}:i);
       if(cost(provisional)>Number(j.authorizedSpend))fail("The proposed basket exceeds the customer's authorized merchandise total.");
     }else{
       if(!input.replacementName||input.note.trim().length<8||!input.actualQuantity||typeof input.actualUnitPrice!=="number")
         fail("Describe the proposed replacement, price and why it is needed.");
       row.status="substitution_pending";row.replacementName=input.replacementName;
       row.proposedQuantity=input.actualQuantity;row.proposedUnitPrice=input.actualUnitPrice;
       const provisional=items.map(i=>i.itemId===input.itemId?{...i,status:"substituted",actualQuantity:input.actualQuantity,actualUnitPrice:input.actualUnitPrice}:
         ["pending","substitution_pending"].includes(i.status)?{...i,status:"unavailable"}:i);
       if(cost(provisional)>Number(j.authorizedSpend))fail("The proposed replacement exceeds the authorized shopping funds.");
       tx.update(reqRef,{pendingSubstitutions:FieldValue.arrayUnion({itemId:row.itemId,
         replacementName:row.replacementName,quantity:row.proposedQuantity,unitPrice:row.proposedUnitPrice,
         note:input.note}),customerMessage:"Your shopper needs your approval for a replacement.",updatedAt:now});
     }
     tx.update(jobRef,{items,updatedAt:now});
     state=j.state;
   }else if(input.action==="receipt"){
     if(j.state!=="shopping")fail("Finish shopping before submitting the receipt.");
     const amount=cost(items);
     if(amount>Number(j.authorizedSpend))fail("The receipt exceeds customer-authorized funds.");
     if(!upload?.exists)fail("Upload the actual store receipt first.");
     state="receipt_submitted";
     tx.update(jobRef,{receiptPath:upload.data().storagePath,actualSpend:amount,receiptSubmittedAt:now});
   }else if(input.action==="en_route"){
     if(j.state!=="collected")fail("Operations must approve the receipt before delivery.");
     state="en_route";
   }else{
     if(j.state!=="en_route")fail("You cannot complete delivery before approved purchase and handoff.");
     if(!matchesPin(input.requestId,input.pin||"",j.customerPinHash))fail("The customer's handoff PIN is incorrect.",422);
     state="delivered";
     const presenceRef=db.collection("driverPresence").doc(user.uid);
     const presence=await tx.get(presenceRef);
     if(presence.exists&&presence.data().currentJobId===jobRef.id)
       tx.update(presenceRef,{currentJobId:FieldValue.delete(),currentWorkType:FieldValue.delete(),updatedAt:now});
   }
   if(!["item","propose_substitution"].includes(input.action)){
     tx.update(jobRef,{state,updatedAt:now,...(state==="delivered"?{deliveredAt:now}:{})});
     tx.update(reqRef,{state,dispatchStatus:state,updatedAt:now,
       customerMessage:state==="delivered"?"Your independent purchase has been delivered. Any refund due remains subject to provider reconciliation.":q.customerMessage});
   }
   tx.create(db.collection("assistShoppingEvents").doc(),{
     requestId:input.requestId,driverId:user.uid,actorId:user.uid,action:input.action,state,createdAt:now});
  });
  return Response.json({ok:true,state,merchantOrderCreated:false});
 }catch(e){if(e instanceof z.ZodError)return Response.json({ok:false,error:"Review the independent shopping job details.",details:e.flatten()},{status:422});return apiError(e)}
}
