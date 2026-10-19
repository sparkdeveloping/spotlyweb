import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
export const runtime="nodejs";
const schema=z.object({businessId:z.string().min(2).max(180),accepting:z.boolean()}).strict();
export async function POST(request){
  try{
    const actor=await authenticateRequest(request,{roles:["super_admin","platform_admin","operations_manager","regional_operations_manager"]});
    const input=schema.parse(await request.json());
    const {db}=getAdminServices(),ref=db.collection("businesses").doc(input.businessId);
    const snap=await ref.get();
    if(!snap.exists)throw Object.assign(new Error("Business not found."),{status:404});
    await ref.update({assistAccepting:input.accepting,assistUpdatedBy:actor.uid,assistUpdatedAt:FieldValue.serverTimestamp()});
    await db.collection("auditLogs").add({action:"assist.location_availability.updated",actorId:actor.uid,entityId:input.businessId,entityType:"business",metadata:{accepting:input.accepting},createdAt:FieldValue.serverTimestamp()});
    return Response.json({ok:true,businessId:input.businessId,accepting:input.accepting});
  }catch(error){if(error instanceof z.ZodError)return Response.json({ok:false,error:"Invalid location availability."},{status:422});return apiError(error);}
}
