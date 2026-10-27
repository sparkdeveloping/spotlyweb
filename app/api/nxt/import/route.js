import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import starter from "@/data/nxt-outreach-starter.json";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { requireNxt, noStore, audit } from "@/lib/nxt-server";
import { cleanProspect } from "@/lib/nxt-policy";
export const runtime="nodejs";
const schema=z.object({action:z.enum(["preview","import"]),offset:z.number().int().min(0).max(10000).default(0),confirm:z.boolean().optional()}).strict();
export async function POST(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"import");
  const body=schema.parse(await request.json());const rows=starter.rows;
  if(body.action==="preview")return noStore({ok:true,total:rows.length,withPhone:rows.filter(r=>r.phone).length,categories:Object.entries(rows.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]),note:starter.publicationPolicy});
  if(body.confirm!==true)throw Object.assign(new Error("Import requires explicit confirmation."),{status:400});
  await enforceRateLimit(request,{key:"nxt_import",limit:20,windowMs:60_000,identity:actor.uid});
  const {db}=getAdminServices();const part=rows.slice(body.offset,body.offset+80);
  const refs=part.map(r=>db.collection("nxtProspects").doc(`nxt-${r.sourceId}`));
  const existing=refs.length?await db.getAll(...refs):[];
  const batch=db.batch();let inserted=0;
  part.forEach((r,i)=>{
   if(existing[i]?.exists)return;
   // NXT prospects are private research records, not customer-visible businesses.
   batch.create(refs[i],{...cleanProspect(r),sourceId:r.sourceId,source:"spotly_outreach_workbook_2026_10_27",sourceNote:r.sourceNote,
    assigneeUid:"",status:"new",public:false,claimStatus:"unclaimed",verificationStatus:"unverified",createdBy:actor.uid,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});inserted++;
  });
  if(inserted)await batch.commit();
  await audit(db,actor,"nxt.workbook_import","nxtProspects","2026-10-27",{offset:body.offset,examined:part.length,created:inserted});
  return noStore({ok:true,inserted,examined:part.length,nextOffset:body.offset+part.length,hasMore:body.offset+part.length<rows.length,total:rows.length});
 }catch(e){return apiError(e);}
}
