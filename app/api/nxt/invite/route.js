import { randomBytes, createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireNxt, audit, noStore } from "@/lib/nxt-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";
export const runtime="nodejs";
const schema=z.object({prospectId:z.string().min(3).max(140),email:z.string().email().max(254)}).strict();
export async function POST(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"prospects");
  await enforceRateLimit(request,{key:"nxt_owner_invite",limit:15,windowMs:3600000,identity:actor.uid});
  const data=schema.parse(await request.json()),{db}=getAdminServices();
  const p=await db.collection("nxtProspects").doc(data.prospectId).get();if(!p.exists||!p.data().businessId)throw Object.assign(new Error("First link a private Spotly business draft."),{status:400});
  const b=await db.collection("businesses").doc(p.data().businessId).get();if(!b.exists)throw Object.assign(new Error("Business draft no longer exists."),{status:404});
  if(b.data().claimStatus==="claimed"&&b.data().verificationStatus==="approved")throw Object.assign(new Error("Already claimed. Use Spotly Admin for verified owner changes."),{status:409});
  const token=randomBytes(32).toString("hex"),hash=createHash("sha256").update(token).digest("hex");
  await db.collection("nxtClaimInvites").doc(hash).create({businessId:b.id,prospectId:p.id,email:data.email.toLowerCase(),createdBy:actor.uid,createdAt:FieldValue.serverTimestamp(),expiresAt:new Date(Date.now()+7*86400000),status:"issued"});
  await audit(db,actor,"nxt.owner_claim_invite","business",b.id,{prospectId:p.id,recipientEmail:data.email.toLowerCase()});
  return noStore({ok:true,url:`https://spotlyafrica.com/claim?business=${encodeURIComponent(b.id)}&invite=${token}`,expiresInDays:7,note:"Only shares business prefill. Claim ownership still requires independent evidence and Spotly verification."});
 }catch(e){return apiError(e);}
}
