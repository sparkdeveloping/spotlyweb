import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","regional_operations_manager","support_manager"];
const schema=z.object({
  bookingId:z.string().min(12).max(250),
  action:z.enum(["assign","contacted","offer_alternative","confirm","decline","cancel"]),
  alternativeAt:z.string().datetime({offset:true}).optional(),
  operatorNote:z.string().trim().max(1000).default(""),
  assigneeId:z.string().max(180).optional()
}).strict();
const transitions={
 requested:["assign","contacted","offer_alternative","confirm","decline","cancel"],
 assigned:["contacted","offer_alternative","confirm","decline","cancel"],
 contacting_business:["offer_alternative","confirm","decline","cancel"],
 alternative_offered:["decline","cancel"],
 alternative_accepted:["contacted","confirm","decline","cancel"],
 alternative_declined:["contacted","offer_alternative","decline","cancel"]
};
const outcomes={assign:"assigned",contacted:"contacting_business",offer_alternative:"alternative_offered",confirm:"confirmed",decline:"declined",cancel:"cancelled"};
export async function GET(request){
  try{
    await authenticateRequest(request,{roles});
    const {db}=getAdminServices(),url=new URL(request.url),country=url.searchParams.get("country")?.toUpperCase()||"";
    const docs=await db.collection("assistedBookings").limit(150).get();
    return Response.json({ok:true,bookings:docs.docs.map(s=>({id:s.id,...s.data(),createdAt:s.data().createdAt?.toDate?.()?.toISOString?.()||null})).filter(i=>!country||i.country===country).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiError(error);}
}
export async function POST(request){
  try{
    const actor=await authenticateRequest(request,{roles}),input=schema.parse(await request.json());
    const {db}=getAdminServices(),ref=db.collection("assistedBookings").doc(input.bookingId);
    let result;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error("Booking request not found."),{status:404});
      const entry=snap.data(),allowed=transitions[entry.state]||[];
      if(!allowed.includes(input.action))throw Object.assign(new Error("This booking state does not permit that action."),{status:409});
      if(input.action==="offer_alternative"){
        const time=Date.parse(input.alternativeAt||"");
        if(!Number.isFinite(time)||time<=Date.now())throw Object.assign(new Error("Offer a future alternative time."),{status:422});
      }
      if(input.action==="confirm"&&!["requested","assigned","contacting_business","alternative_accepted"].includes(entry.state))throw Object.assign(new Error("The customer must accept the alternative first."),{status:409});
      if(input.action==="confirm"&&!input.operatorNote)throw Object.assign(new Error("Record how the business confirmed this appointment."),{status:422});
      const state=outcomes[input.action],patch={state,updatedAt:FieldValue.serverTimestamp(),lastAgentId:actor.uid,customerMessage:input.action==="offer_alternative"?"That time isn't available. Please accept or decline the suggested alternative.":input.action==="confirm"?"Spotly confirmed your appointment directly with the business.":input.action==="decline"?"The requested appointment could not be arranged.":entry.customerMessage};
      if(input.action==="assign")patch.assignedTo=input.assigneeId||actor.uid;
      if(input.action==="offer_alternative")patch.alternativeAt=input.alternativeAt;
      if(input.action==="confirm")patch.confirmedAt=new Date().toISOString();
      tx.update(ref,patch);
      tx.create(db.collection("assistedBookingEvents").doc(),{bookingId:ref.id,actorId:actor.uid,actorType:"admin",type:input.action,previousState:entry.state,state,note:input.operatorNote,createdAt:FieldValue.serverTimestamp()});
      result={id:ref.id,state};
    });
    return Response.json({ok:true,...result});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review this booking action."},{status:422});
    return apiError(error);
  }
}
