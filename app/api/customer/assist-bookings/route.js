import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { regionalServicePolicy } from "@/lib/v9-assist-regions";
import { notifyRoleAudience } from "@/lib/notification-server";
export const runtime = "nodejs";
const schema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{12,70}$/),
  businessId: z.string().min(2).max(180),
  serviceName: z.string().trim().min(2).max(160),
  requestedAt: z.string().datetime({ offset: true }),
  flexibility: z.enum(["exact","nearby","any_time_that_day"]).default("nearby"),
  phone: z.string().trim().min(7).max(40),
  notes: z.string().trim().max(600).default("")
}).strict();
export async function GET(request) {
  try {
    const user = await authenticateRequest(request);
    const { db } = getAdminServices();
    const snapshot = await db.collection("assistedBookings").where("customerId","==",user.uid).limit(40).get();
    return Response.json({ok:true,bookings:snapshot.docs.map(doc=>({id:doc.id,...pick(doc.data())}))},{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return apiError(error); }
}
function pick(d) {
  return { businessName:d.businessName,serviceName:d.serviceName,requestedAt:d.requestedAt,alternativeAt:d.alternativeAt||null,state:d.state,confirmedAt:d.confirmedAt||null,operatorNote:d.customerMessage||"",customerDecision:d.customerDecision||null };
}
export async function POST(request) {
  try {
    const user=await authenticateRequest(request);
    const input=schema.parse(await request.json());
    const rate=await enforceRateLimit(request,{key:"assist-bookings",limit:8,windowMs:60*60_000,identity:user.uid});
    const {db,messaging,auth}=getAdminServices();
    const ref=db.collection("assistedBookings").doc(user.uid+"_"+input.requestId);
    const now=Date.now(),requested=Date.parse(input.requestedAt);
    if (!Number.isFinite(requested)||requested<now+10*60_000||requested>now+90*86400000) throw Object.assign(new Error("Choose a future time within 90 days."),{status:422});
    const original=await ref.get();
    if(original.exists) return Response.json({ok:true,id:ref.id,...pick(original.data()),idempotent:true});
    const [businessSnap,settingsSnap]=await Promise.all([db.collection("businesses").doc(input.businessId).get(),db.collection("platformSettings").doc("global").get()]);
    const business=businessSnap.data(),settings=settingsSnap.data()||{};
    if(!businessSnap.exists||business.public!==true||["archived","removed"].includes(business.status)) throw Object.assign(new Error("This business isn't available for a booking request."),{status:404});
    if(business.assistAccepting===false) throw Object.assign(new Error("This business has paused assisted requests."),{status:409});
    if(!regionalServicePolicy(settings.assistCoverage||{},business,"book").available) throw Object.assign(new Error("Spotly Assist bookings are unavailable in this location."),{status:409});
    if(["clinic","hospital","medical","dentist","doctor","pharmacy"].some(x=>String(business.category||"").toLowerCase().includes(x))) throw Object.assign(new Error("Assisted booking is not available for this category."),{status:409});
    const entry={customerId:user.uid,businessId:input.businessId,businessName:business.name||"Business",country:business.country||"ZW",city:business.city||"",phone:input.phone,serviceName:input.serviceName,requestedAt:input.requestedAt,flexibility:input.flexibility,notes:input.notes,state:"requested",customerDecision:null,alternativeAt:null,customerMessage:"Spotly will contact the business to check availability. This is not a confirmed appointment.",paymentStatus:"not_initiated",source:"spotly_assist",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
    try{await ref.create(entry);}catch(err){if(Number(err?.code)!==6&&String(err?.code)!=="already-exists")throw err;const existing=await ref.get();return Response.json({ok:true,id:ref.id,...pick(existing.data()),idempotent:true});}
    await notifyRoleAudience({
      db,messaging,auth,title:"Assisted booking needs a call",
      body:(business.name||"Business")+" · "+input.serviceName+" · "+input.requestedAt,
      workspace:"admin",href:"/assist",category:"assist_booking",
      module:"spotly_assist",eventType:"assist.booking.requested"
    },["operations_manager","support_manager"]).catch(()=>{});
    return Response.json({ok:true,id:ref.id,...pick(entry)},{headers:{"Cache-Control":"private, no-store","X-RateLimit-Remaining":String(rate.remaining)}});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review your booking request and preferred time."},{status:422});
    return apiError(error);
  }
}
