import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { requireNxt, noStore, audit } from "@/lib/nxt-server";
export const runtime="nodejs";
const schema=z.object({prospectId:z.string().min(3).max(140),confirmReviewedDuplicates:z.literal(true)}).strict();
function words(...parts){return [...new Set(parts.join(" ").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/).filter(x=>x.length>1))].slice(0,70);}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"prospects");
  await enforceRateLimit(request,{key:"nxt_onboard",limit:12,windowMs:3600000,identity:actor.uid});
  const input=schema.parse(await request.json());const {db}=getAdminServices();
  const prospectRef=db.collection("nxtProspects").doc(input.prospectId);
  const result=await db.runTransaction(async tx=>{
   const existing=await tx.get(prospectRef);if(!existing.exists)throw Object.assign(new Error("Outreach record not found."),{status:404});
   const p=existing.data();if(p.businessId)throw Object.assign(new Error("Already linked to a Spotly business. Open that record instead of creating a duplicate."),{status:409});
   if(!p.name||!p.city)throw Object.assign(new Error("Business name and city are required before creating the draft."),{status:400});
   const org=db.collection("organizations").doc(),business=db.collection("businesses").doc(),branch=db.collection("branches").doc();const now=FieldValue.serverTimestamp();
   tx.create(org,{name:p.name,businessIds:[business.id],branchIds:[branch.id],ownerIds:[],status:"provisional",country:"ZW",source:{type:"nxt_partner_onboarding",prospectId:prospectRef.id},createdAt:now,updatedAt:now});
   tx.create(business,{organizationId:org.id,branchIds:[branch.id],branchCount:1,ownerIds:[],name:p.name,brandName:p.name,category:p.category||"Business",categories:[p.category||"Business"],businessType:"directory_profile",capabilities:["profile","enquiries"],operatingModel:"physical_single",country:"ZW",city:p.city,description:p.description||"Business details awaiting owner review and verification.",phone:p.phone||"",email:p.email||"",website:p.website||"",address:p.address||"",public:false,status:"provisional",verificationStatus:"unverified",claimStatus:"unclaimed",onboardingStatus:"not_started",source:{type:"nxt_partner_onboarding",prospectId:prospectRef.id,createdBy:actor.uid},searchTerms:words(p.name,p.category,p.city,p.address),createdAt:now,updatedAt:now,createdBy:actor.uid});
   tx.create(branch,{businessId:business.id,organizationId:org.id,name:p.name,branchName:p.name,city:p.city,country:"ZW",address:p.address||"",phone:p.phone||"",email:p.email||"",public:false,status:"provisional",pickup:{enabled:false},fulfilment:[],openingHours:{},source:{type:"nxt_partner_onboarding"},createdAt:now,updatedAt:now});
   tx.update(prospectRef,{businessId:business.id,status:"onboarding",updatedAt:now,updatedBy:actor.uid});
   tx.create(db.collection("nxtInteractions").doc(),{prospectId:prospectRef.id,kind:"draft_created",channel:"other",outcome:"connected",actorUid:actor.uid,note:`Private business draft ${business.id} created; pending owner claim and verification.`,occurredAt:now,createdAt:now});
   return {businessId:business.id,organizationId:org.id,branchId:branch.id};
  });
  await audit(db,actor,"nxt.business_draft_created","business",result.businessId,{prospectId:input.prospectId});
  return noStore({ok:true,...result,claimUrl:`https://spotlyafrica.com/claim?business=${encodeURIComponent(result.businessId)}`,note:"Unpublished draft created. Invite the legal owner to claim and prove ownership. NXT never receives verified owner rights automatically."},201);
 }catch(e){return apiError(e);}
}
