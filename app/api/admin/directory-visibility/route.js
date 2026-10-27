import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { isVerifiedClaim } from "@/lib/nxt-policy";
import { noStore } from "@/lib/nxt-server";
export const runtime="nodejs";
const schema=z.object({mode:z.enum(["preview","hide_unverified"]),cursor:z.string().max(160).optional().default(""),confirm:z.boolean().optional()}).strict();
export async function POST(request) {
 try {
  const actor=await authenticateRequest(request);requirePlatformPermission(actor,"admin.configuration");
  const body=schema.parse(await request.json());
  if(body.mode==="hide_unverified"&&body.confirm!==true)throw Object.assign(new Error("Please confirm you want to hide unverified public records."),{status:400});
  const {db}=getAdminServices();const col=db.collection("businesses");
  // Cursor is by document ID, not by public status; changed documents do not
  // disappear from the scan and cause gaps between pages.
  let q=col.orderBy(FieldPath.documentId()).limit(90);
  if(body.cursor)q=q.startAfter(body.cursor);
  const page=await q.get();let unverified=0, hidden=0, protectedClaims=0;
  const toHide=[];
  for(const doc of page.docs){const b=doc.data();if(isVerifiedClaim(b)){protectedClaims++;continue;}if(b.public===true){unverified++;toHide.push(doc.ref);}}
  if(body.mode==="hide_unverified"&&toHide.length){
   await db.runTransaction(async tx=>{
    const fresh=await tx.getAll(...toHide);
    for(const doc of fresh){
     if(!doc.exists||doc.data().public!==true||isVerifiedClaim(doc.data()))continue;
     tx.update(doc.ref,{public:false,previousPublic:true,visibilityPolicy:"verified_claim_required",visibilityReviewedAt:FieldValue.serverTimestamp(),visibilityReviewedBy:actor.uid});hidden++;
    }
    tx.create(db.collection("auditLogs").doc(),{action:"directory.hide_unverified",entityType:"businesses",entityId:"nxt_migration",actorId:actor.uid,metadata:{hidden,scanned:page.size},createdAt:FieldValue.serverTimestamp()});
   });
  }
  return noStore({ok:true,scanned:page.size,unverified,protectedClaims,hidden,nextCursor:page.size===90?page.docs.at(-1).id:null,complete:page.size<90,
   note:"Hides only currently public records without verified approved ownership. Preserves all records, claims, source data and contact details. Approval never grants publication automatically."});
 }catch(e){return apiError(e);}
}
