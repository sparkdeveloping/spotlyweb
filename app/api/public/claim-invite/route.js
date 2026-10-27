import { createHash } from "node:crypto";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
export const runtime="nodejs";
export async function GET(request){
 try{
  await verifyAppCheckRequest(request,{required:false});await enforceRateLimit(request,{key:"claim_invite_prefill",limit:35,windowMs:60000});
  const token=new URL(request.url).searchParams.get("token")||"";
  if(!/^[a-f0-9]{64}$/.test(token))throw Object.assign(new Error("Invitation link is invalid."),{status:400});
  const {db}=getAdminServices(),id=createHash("sha256").update(token).digest("hex");
  const invite=await db.collection("nxtClaimInvites").doc(id).get();
  if(!invite.exists||invite.data().status!=="issued"||invite.data().expiresAt.toMillis()<Date.now())throw Object.assign(new Error("The invitation has expired or been revoked."),{status:404});
  const b=await db.collection("businesses").doc(invite.data().businessId).get();
  if(!b.exists)throw Object.assign(new Error("Business not found."),{status:404});
  const source=b.data(),branches=await db.collection("branches").where("businessId","==",b.id).limit(30).get();
  // Do not return private NXT notes, lead history, internal identifiers or evidence.
  return Response.json({ok:true,business:{id:b.id,name:source.name||"",brandName:source.brandName||"",category:source.category||"",city:source.city||"",address:source.address||"",phone:source.phone||"",email:source.email||"",website:source.website||"",businessType:source.businessType||"directory_profile",description:source.description||"",organizationId:source.organizationId||"",claimStatus:source.claimStatus||"unclaimed",source:{type:"nxt_partner_onboarding"}},branches:branches.docs.map(d=>({id:d.id,businessId:b.id,branchName:d.data().branchName||"Main location",city:d.data().city||"",address:d.data().address||"",phone:d.data().phone||"",public:false}))},{headers:{"Cache-Control":"private,no-store"}});
 }catch(e){return apiError(e);}
}
