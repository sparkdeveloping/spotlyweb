import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { countryDefinition } from "@/lib/country-engine";
export const runtime = "nodejs";
const roles = ["super_admin", "platform_admin", "operations_manager", "regional_operations_manager"];
const targetSchema = z.string().trim().min(8).max(160);
const putSchema = z.object({ uid: targetSchema, countryCode: z.enum(["ZW","MW"]), reason: z.string().trim().min(8).max(500) }).strict();

export async function GET(request) {
  try {
    await authenticateRequest(request,{roles});
    const uid=targetSchema.parse(new URL(request.url).searchParams.get("uid")||"");
    const {db}=getAdminServices();
    const snap=await db.collection("accountCountryOverrides").doc(uid).get();
    return Response.json({ok:true,override:snap.exists?{id:snap.id,...snap.data()}:null},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return apiError(error); }
}

export async function PUT(request) {
  try {
    const actor=await authenticateRequest(request,{roles});
    const input=putSchema.parse(await request.json());
    if(!countryDefinition(input.countryCode)) throw Object.assign(new Error("Unsupported country."),{status:422});
    const {db}=getAdminServices();
    const userRef=db.collection("users").doc(input.uid), overrideRef=db.collection("accountCountryOverrides").doc(input.uid);
    await db.runTransaction(async tx=>{
      const [userSnap,current]=await Promise.all([tx.get(userRef),tx.get(overrideRef)]);
      if(!userSnap.exists) throw Object.assign(new Error("Spotly account not found."),{status:404});
      const now=FieldValue.serverTimestamp();
      tx.set(overrideRef,{uid:input.uid,countryCode:input.countryCode,reason:input.reason,active:true,createdAt:current.exists?current.data().createdAt:now,updatedAt:now,updatedBy:actor.uid},{merge:false});
      tx.create(db.collection("auditLogs").doc(),{action:"account.country_override.set",actorId:actor.uid,entityType:"user",entityId:input.uid,metadata:{countryCode:input.countryCode,reason:input.reason},createdAt:now});
    });
    return Response.json({ok:true,countryCode:input.countryCode});
  } catch(error) {
    if(error instanceof z.ZodError) return Response.json({ok:false,error:"Choose an account, supported country, and a reason."},{status:422});
    return apiError(error);
  }
}

export async function DELETE(request) {
  try {
    const actor=await authenticateRequest(request,{roles});
    const body=z.object({uid:targetSchema,reason:z.string().trim().min(8).max(500)}).strict().parse(await request.json());
    const {db}=getAdminServices();
    const ref=db.collection("accountCountryOverrides").doc(body.uid);
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(snap.exists) tx.delete(ref);
      tx.create(db.collection("auditLogs").doc(),{action:"account.country_override.cleared",actorId:actor.uid,entityType:"user",entityId:body.uid,metadata:{previousCountryCode:snap.data()?.countryCode||null,reason:body.reason},createdAt:FieldValue.serverTimestamp()});
    });
    return Response.json({ok:true});
  } catch(error) {
    if(error instanceof z.ZodError) return Response.json({ok:false,error:"Provide an account and reason."},{status:422});
    return apiError(error);
  }
}
