import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { normalizeCountryCode, countryCity } from "@/lib/country-engine";
import { normalizeRegistrationKey, registrationDocumentId, continuationProof, publicRegistrationReceipt, safeRegistrationStatus } from "@/lib/business-registration-policy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = {"Cache-Control":"private, no-store"};
const createSchema = z.object({
  idempotencyKey: z.string().trim().min(25).max(80),
  applicantName:z.string().trim().min(2).max(160), phone:z.string().trim().min(5).max(40),
  email:z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  roleAtBusiness:z.enum(["owner","manager","authorized_representative","other"]).default("owner"),
  contactPreference:z.enum(["whatsapp","phone","email"]).default("whatsapp"),
  businessName:z.string().trim().min(2).max(180),
  registrationStatus:z.enum(["registered","in_process","not_registered"]).default("not_registered"),
  category:z.string().trim().min(1).max(120), country:z.string().trim().min(2).max(2),
  city:z.string().trim().min(2).max(100), notes:z.string().trim().max(1000).default(""),
  contactConsent:z.literal(true)
});
const idPattern = /^(?:br_[a-f0-9]{40}|[A-Za-z0-9]{16,40})$/;
const changeSchema = z.object({
  id:z.string().regex(idPattern),
  status:z.enum(["new","seen","contacted","qualified","verification_invited","closed"]).optional(),
  assignmentAction:z.enum(["claim","release"]).optional(),
  note:z.string().trim().max(1500).optional()
}).refine(x=>x.status||x.assignmentAction||x.note?.length,{message:"Nothing to update."});
function deny(err,status=400){return Response.json({ok:false,error:err},{status,headers:noStore});}
function serialize(doc){const d=doc.data()||{};const when=t=>t?.toDate?.()?.toISOString?.()||null;
  return {id:doc.id,applicantName:d.applicantName||"",phone:d.phone||"",email:d.email||"",roleAtBusiness:d.roleAtBusiness||"owner",contactPreference:d.contactPreference||"whatsapp",businessName:d.businessName||"",registrationStatus:d.registrationStatus||"",category:d.category||"",country:d.country||"",city:d.city||"",notes:d.notes||"",status:safeRegistrationStatus(d.status || (d.seen ? "seen" : "new")),assignedTo:d.assignedTo||"",createdAt:when(d.createdAt),updatedAt:when(d.updatedAt),contactedAt:when(d.contactedAt),linkedClaimId:d.linkedClaimId||null};}
function requireRead(actor){requirePlatformPermission(actor,"businesses.read",{roles:["operations_manager","regional_operations_manager","business_success_manager","verification_officer"]});}
function requireWrite(actor){requirePlatformPermission(actor,"businesses.update",{roles:["operations_manager","business_success_manager","verification_officer"]});}

// Anonymous prospect intake; all internal reads and writes are authenticated separately.
export async function POST(request){
 try {
  const length=Number(request.headers.get("content-length")||0);
  if(length>6000)return deny("Registration is too large.",413);
  await verifyAppCheckRequest(request);
  await enforceRateLimit(request,{key:"business-registration-intake",limit:8,windowMs:30*60_000});
  const raw=await request.text();if(raw.length>6000)return deny("Registration is too large.",413);
  let parsed;try{parsed=createSchema.parse(JSON.parse(raw));}catch{return deny("Please review your business and contact details.");}
  const country=normalizeCountryCode(parsed.country);if(!country)return deny("Choose a supported country.");
  if(parsed.contactPreference==="email"&&!parsed.email)return deny("Enter an email address for email contact.");
  if(!normalizeRegistrationKey(parsed.idempotencyKey))return deny("Please retry this registration.");
  const id=registrationDocumentId(parsed.idempotencyKey,country,parsed.phone);
  const city=countryCity(country,parsed.city)?.name||parsed.city;
  const {db}=getAdminServices(),ref=db.collection("businessRegistrations").doc(id);
  // Create-only: a slow response or double-tap cannot generate another lead.
  try{await ref.create({applicantName:parsed.applicantName,phone:parsed.phone,email:parsed.email.toLowerCase(),roleAtBusiness:parsed.roleAtBusiness,contactPreference:parsed.contactPreference,businessName:parsed.businessName,registrationStatus:parsed.registrationStatus,category:parsed.category,country,city,notes:parsed.notes,status:"new",assignedTo:"",source:"public_business_get_started",contactConsentVersion:"business_intake_2026_11",contactConsent:true,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),contactedAt:null,linkedClaimId:null,continuationProof:continuationProof(parsed.idempotencyKey,id),applicantUid:null});}
  catch(error){if(error.code!==6&&error.code!=="already-exists"&&error.code!=="firestore/already-exists")throw error;}
  return Response.json(publicRegistrationReceipt(id),{status:201,headers:noStore});
 }catch(error){return apiError(error);}
}

export async function GET(request){
 try{const actor=await authenticateRequest(request);requireRead(actor);
  await enforceRateLimit(request,{key:"admin-business-leads-read",identity:actor.uid,limit:40,windowMs:60_000});
  const url=new URL(request.url),requested=Number(url.searchParams.get("limit")||40);
  const limit=Number.isInteger(requested)?Math.min(Math.max(requested,1),100):40;
  const {db}=getAdminServices();
  const historyId=url.searchParams.get("history")||"";
  if (historyId) {
    if (!idPattern.test(historyId)) return deny("Invalid registration reference.");
    const leadRef=db.collection("businessRegistrations").doc(historyId);
    const lead=await leadRef.get();if(!lead.exists)return deny("Registration not found.",404);
    const history=await leadRef.collection("events").orderBy("createdAt","desc").limit(30).get();
    const entries=history.docs.map(doc=>({id:doc.id,action:doc.data().action||"",actorId:doc.data().actorId||"",from:doc.data().from||"",to:doc.data().to||"",note:doc.data().note||"",createdAt:doc.data().createdAt?.toDate?.()?.toISOString?.()||null}));
    return Response.json({ok:true,history:entries},{headers:noStore});
  }
  let query=db.collection("businessRegistrations").orderBy("createdAt","desc").limit(limit);
  const cursor=url.searchParams.get("cursor")||"";
  if(cursor){if(!/^(?:br_[a-f0-9]{40}|[A-Za-z0-9]{16,40})$/.test(cursor))return deny("Invalid page cursor.");const previous=await db.collection("businessRegistrations").doc(cursor).get();if(!previous.exists)return deny("Page expired. Refresh to continue.");query=query.startAfter(previous);}
  const snap=await query.get();return Response.json({ok:true,registrations:snap.docs.map(serialize),nextCursor:snap.size===limit?snap.docs.at(-1)?.id:null},{headers:noStore});
 }catch(error){return apiError(error);}
}

export async function PATCH(request){
 try{const actor=await authenticateRequest(request);requireWrite(actor);
  await enforceRateLimit(request,{key:"admin-business-leads-write",identity:actor.uid,limit:30,windowMs:60_000});
  let change;try{change=changeSchema.parse(await request.json());}catch{return deny("Review the update details.");}
  const {db}=getAdminServices(),ref=db.collection("businessRegistrations").doc(change.id);
  // Transaction keeps workflow state and audit together, never grants business ownership.
  const outcome=await db.runTransaction(async tx=>{const before=await tx.get(ref);
   if(!before.exists)throw Object.assign(new Error("Registration not found."),{status:404});
   const previous=before.data()||{};
   const oldStatus=safeRegistrationStatus(previous.status);
   const next=change.status||oldStatus;
   const previousAssignee=previous.assignedTo||"";
   if(change.assignmentAction==="claim"&&previousAssignee&&previousAssignee!==actor.uid)throw Object.assign(new Error("Another team member already owns this follow-up."),{status:409});
   if(change.assignmentAction==="release"&&previousAssignee!==actor.uid)throw Object.assign(new Error("Only the assigned team member can release this follow-up."),{status:403});
   const newAssignee=change.assignmentAction==="claim"?actor.uid:change.assignmentAction==="release"?"":previousAssignee;
   const updates={status:next,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.uid};
   if(change.assignmentAction)updates.assignedTo=newAssignee;
   if(next==="contacted"&&!previous.contactedAt)updates.contactedAt=FieldValue.serverTimestamp();
   const changed=next!==oldStatus||newAssignee!==previousAssignee||Boolean(change.note?.trim());
   if(!changed)return {status:next,assignedTo:newAssignee};
   tx.update(ref,updates);
   // Private history: free-form notes never enter broadly available audit metadata.
   tx.create(ref.collection("events").doc(),{action:change.note?.trim()?"note":change.assignmentAction?"assignment":"stage",from:oldStatus,to:next,previousAssignee,newAssignee,actorId:actor.uid,note:change.note?.trim()||"",createdAt:FieldValue.serverTimestamp()});
   tx.create(db.collection("auditLogs").doc(),{actorId:actor.uid,action:"business_registration.updated",entityType:"businessRegistration",entityId:change.id,metadata:{from:oldStatus,to:next,assigneeChanged:newAssignee!==previousAssignee,hasPrivateNote:Boolean(change.note?.trim())},createdAt:FieldValue.serverTimestamp()});
   return {status:next,assignedTo:newAssignee};
  });
  return Response.json({ok:true,...outcome},{headers:noStore});
 }catch(error){return apiError(error);}
}
// Intentionally no DELETE route: admissions and outreach history require audited retention policies.
