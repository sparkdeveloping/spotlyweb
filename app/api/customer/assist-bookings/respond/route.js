import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
export const runtime="nodejs";
const schema=z.object({id:z.string().min(12).max(250),decision:z.enum(["accept_alternative","decline_alternative","cancel"])}).strict();
export async function POST(request) {
  try{
    const user=await authenticateRequest(request),input=schema.parse(await request.json());
    const {db}=getAdminServices(),ref=db.collection("assistedBookings").doc(input.id);
    let state;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists||snap.data().customerId!==user.uid)throw Object.assign(new Error("Booking request not found."),{status:404});
      const d=snap.data();
      if(input.decision==="cancel"){
        if(["confirmed","cancelled","declined"].includes(d.state))throw Object.assign(new Error("Contact support about changes to a confirmed or completed request."),{status:409});
        state="cancelled";
      }else {
        if(d.state!=="alternative_offered"||!d.alternativeAt)throw Object.assign(new Error("There is no current alternative to review."),{status:409});
        state=input.decision==="accept_alternative"?"alternative_accepted":"alternative_declined";
      }
      tx.update(ref,{state,customerDecision:input.decision,updatedAt:FieldValue.serverTimestamp()});
      tx.create(db.collection("assistedBookingEvents").doc(),{bookingId:ref.id,actorId:user.uid,actorType:"customer",type:input.decision,state,createdAt:FieldValue.serverTimestamp()});
    });
    return Response.json({ok:true,state});
  }catch(error){if(error instanceof z.ZodError)return Response.json({ok:false,error:"Invalid booking decision."},{status:422});return apiError(error);}
}
