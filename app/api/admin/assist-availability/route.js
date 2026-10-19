import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
export const runtime="nodejs";
const schema=z.object({businessId:z.string().min(2).max(180),accepting:z.boolean()}).strict();
export async function GET(request) {
  try {
    await authenticateRequest(request, { roles: ["super_admin", "platform_admin", "operations_manager", "regional_operations_manager"] });
    const { db } = getAdminServices();
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 120);
    const country = String(url.searchParams.get("country") || "").trim().toUpperCase();
    const snapshot = await db.collection("businesses").where("public", "==", true).limit(250).get();
    const businesses = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || "", city: doc.data().city || "", area: doc.data().area || "", country: doc.data().country || "ZW", accepting: doc.data().assistAccepting !== false }))
      .filter(x => (!country || x.country === country) && (!q || [x.name,x.city,x.area,x.id].join(" ").toLowerCase().includes(q)))
      .sort((a,b) => a.name.localeCompare(b.name)).slice(0, 60);
    return Response.json({ ok: true, businesses }, { headers: { "Cache-Control": "private, no-store" } });
  } catch(error) { return apiError(error); }
}
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
