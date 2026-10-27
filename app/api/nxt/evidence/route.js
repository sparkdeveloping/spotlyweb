import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireNxt, noStore, audit } from "@/lib/nxt-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";
export const runtime = "nodejs";
const MAX_BYTES = 32 * 1024 * 1024;
const types = new Set(["audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "application/pdf", "image/jpeg", "image/png", "image/webp"]);
const requestSchema = z.object({action:z.literal("request_upload"),prospectId:z.string().min(3).max(140),name:z.string().min(1).max(160),mime:z.string().max(70),size:z.number().int().positive().max(MAX_BYTES),recordingConsent:z.boolean().default(false),notes:z.string().max(400).optional()}).strict();
const finishSchema = z.object({action:z.literal("complete_upload"),id:z.string().uuid(),prospectId:z.string().min(3).max(140)}).strict();
function failure(message,status=400){throw Object.assign(new Error(message),{status});}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"evidence");
  await enforceRateLimit(request,{key:"nxt_evidence",limit:35,windowMs:3600000,identity:actor.uid});
  const body=await request.json();const {db,storage}=getAdminServices();
  if(body.action==="request_upload"){
   const input=requestSchema.parse(body);
   if(!types.has(input.mime))failure("Use MP3, MP4 audio, WAV, WebM, OGG, PDF, PNG, JPG or WebP evidence.");
   if(input.mime.startsWith("audio/")&&!input.recordingConsent)failure("Confirm lawful notice and consent before uploading call recordings.");
   if(!(await db.collection("nxtProspects").doc(input.prospectId).get()).exists)failure("Prospect not found.",404);
   const id=randomUUID(),path=`private/nxt-evidence/${input.prospectId}/${id}`,file=storage.bucket().file(path);
   const [signedUrl]=await file.getSignedUrl({version:"v4",action:"write",expires:Date.now()+10*60000,contentType:input.mime});
   await db.collection("nxtEvidence").doc(id).create({prospectId:input.prospectId,path,name:input.name,mime:input.mime,claimedSize:input.size,size:0,status:"pending",notes:input.notes||"",uploadedBy:actor.uid,createdAt:FieldValue.serverTimestamp(),uploadExpiresAt:new Date(Date.now()+10*60000),recordingConsent:input.recordingConsent===true});
   return noStore({ok:true,id,uploadUrl:signedUrl,method:"PUT",mime:input.mime,expiresInSeconds:600},201);
  }
  if(body.action!=="complete_upload")failure("Unsupported evidence action.");
  const input=finishSchema.parse(body),ref=db.collection("nxtEvidence").doc(input.id),snap=await ref.get();
  if(!snap.exists||snap.data().prospectId!==input.prospectId)failure("Evidence record was not found.",404);
  const item=snap.data();if(item.uploadedBy!==actor.uid)failure("Only the uploader may finalize this evidence.",403);
  if(item.status==="ready")return noStore({ok:true,id:input.id});
  if(item.status!=="pending"||item.uploadExpiresAt?.toMillis()<Date.now())failure("The upload request has expired. Please try again.",409);
  const file=storage.bucket().file(item.path);let metadata;
  try{[metadata]=await file.getMetadata();}catch{failure("Upload not found in secure storage. Retry the upload.",409);}
  const length=Number(metadata.size||0);
  if(!length||length>MAX_BYTES||length!==item.claimedSize||metadata.contentType!==item.mime){await file.delete({ignoreNotFound:true});failure("Evidence size or format does not match the requested upload.",400);}
  await ref.update({size:length,status:"ready",completedAt:FieldValue.serverTimestamp()});
  await audit(db,actor,"nxt.evidence_uploaded","nxtEvidence",input.id,{prospectId:input.prospectId,mime:item.mime,size:length});
  return noStore({ok:true,id:input.id});
 }catch(e){return apiError(e);}
}
export async function GET(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"evidence");
  const id=new URL(request.url).searchParams.get("id")||"";if(!/^[a-f0-9-]{36}$/.test(id))failure("Invalid evidence ID.");
  await enforceRateLimit(request,{key:"nxt_evidence_download",limit:70,windowMs:60000,identity:actor.uid});
  const {db,storage}=getAdminServices(),doc=await db.collection("nxtEvidence").doc(id).get();
  if(!doc.exists||doc.data().status!=="ready")failure("Evidence not found.",404);
  const item=doc.data();if(!item.path?.startsWith(`private/nxt-evidence/${item.prospectId}/`))failure("Evidence path invalid.",403);
  const name=String(item.name||"evidence").replace(/[^\w. -]/g,"_").slice(0,100);
  const [url]=await storage.bucket().file(item.path).getSignedUrl({version:"v4",action:"read",expires:Date.now()+60_000,responseDisposition:`attachment; filename="${name}"`,responseType:"application/octet-stream"});
  await audit(db,actor,"nxt.evidence_download","nxtEvidence",id,{prospectId:item.prospectId});
  return noStore({ok:true,url,expiresInSeconds:60});
 }catch(e){return apiError(e);}
}
