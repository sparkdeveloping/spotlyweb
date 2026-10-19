import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
export const runtime="nodejs";

const roles=["super_admin","platform_admin","operations_manager","data_import_manager"];
const https=z.string().url().refine(s=>s.startsWith("https://"),"Use an HTTPS source");
const location=z.object({
 researchId:z.string().regex(/^[A-Za-z0-9_-]{6,100}$/),
 name:z.string().trim().min(2).max(180),city:z.string().trim().min(2).max(100),
 area:z.string().trim().max(100).default(""),address:z.string().trim().max(350).default(""),
 country:z.literal("ZW"),category:z.string().trim().max(100).default("Restaurant"),
 brandName:z.string().trim().max(150).default(""),phone:z.string().trim().max(50).default(""),
 sourceUrl:https,sourceKind:z.string().trim().max(100).default("unknown"),
 observedAt:z.string().datetime({offset:true}),
 reportedCoordinates:z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).nullable().optional()
}).passthrough();
const price=z.object({
 itemId:z.string().regex(/^[A-Za-z0-9_-]{6,100}$/),
 brand:z.string().trim().min(2).max(180),itemName:z.string().trim().min(2).max(180),
 currency:z.literal("USD"),onlineReferencePrice:z.number().finite().min(0).max(100000),
 priceSourceUrl:https,sourceType:z.string().trim().max(120),
 observedAt:z.string().datetime({offset:true})
}).passthrough();
const schema=z.object({
 mode:z.enum(["preview","stage"]),
 sourceLabel:z.string().trim().min(3).max(150),
 locations:z.array(location).max(160),
 prices:z.array(price).max(300),
 reviewAcknowledged:z.boolean().default(false)
}).strict().refine(o=>o.locations.length+o.prices.length>0,"No research records supplied");
const norm=s=>String(s||"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g," ").replace(/\s+/g," ").trim();
const digest=s=>createHash("sha256").update(s).digest("hex").slice(0,26);
const locationKey=l=>[l.country,norm(l.city),norm(l.name),norm(l.address)].join("|");
const safeDocName=s=>String(s||"").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,100);

async function comparison(db,locations){
 // A bounded read gives REVIEW FLAGS; it is never a justification to automatically
 // convert a research record into a merchant or publish it.
 const [businesses,branches]=await Promise.all([
  db.collection("businesses").limit(1200).get(), db.collection("branches").limit(1600).get()
 ]);
 const byBusiness=new Map(businesses.docs.map(d=>[d.id,d.data()]));
 const known=[];
 for(const doc of businesses.docs){
  const d=doc.data();
  known.push({id:doc.id,kind:"business",claimed:d.claimStatus==="claimed"||d.verificationStatus==="approved",name:d.name||"",city:d.city||"",address:d.address||"",country:d.country||"ZW"});
 }
 for(const doc of branches.docs){
  const d=doc.data(),parent=byBusiness.get(d.businessId)||{};
  known.push({id:doc.id,kind:"branch",businessId:d.businessId,claimed:parent.claimStatus==="claimed"||parent.verificationStatus==="approved",name:parent.name||d.name||"",city:d.city||parent.city||"",address:d.address||"",country:d.country||parent.country||"ZW"});
 }
 return {incomplete:businesses.size>=1200||branches.size>=1600,
  collisions:locations.map(l=>{
    const name=norm(l.name),city=norm(l.city),addr=norm(l.address),brand=norm(l.brandName);
    const matches=known.filter(d=>d.country===l.country&&norm(d.city)===city
      && (norm(d.name)===name||norm(d.name)===brand||(addr&&norm(d.address)===addr)))
      .slice(0,8).map(({id,kind,businessId,claimed})=>({id,kind,businessId:businessId||null,claimed}));
    return {researchId:l.researchId,name:l.name,city:l.city,possibleMatches:matches,requiresManualReview:true};
  })
 };
}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles});
  await enforceRateLimit(request,{key:"assist-research-import",limit:15,windowMs:60*60_000,identity:actor.uid});
  const input=schema.parse(await request.json());
  if(input.locations.some(l=>Date.parse(l.observedAt)>Date.now()+86400000) ||
     input.prices.some(p=>Date.parse(p.observedAt)>Date.now()+86400000))
    throw Object.assign(new Error("Observed dates cannot be in the future."),{status:422});
  const locKeys=new Set(),priceKeys=new Set();
  for(const l of input.locations){if(locKeys.has(l.researchId))throw Object.assign(new Error("Duplicate research ID in locations."),{status:422});locKeys.add(l.researchId);}
  for(const p of input.prices){if(priceKeys.has(p.itemId))throw Object.assign(new Error("Duplicate research ID in prices."),{status:422});priceKeys.add(p.itemId);}
  const {db}=getAdminServices();
  const audit=await comparison(db,input.locations);
  if(input.mode==="preview")return Response.json({
   ok:true,mode:"preview",staged:false,
   counts:{locations:input.locations.length,prices:input.prices.length},
   collisions:audit.collisions,comparisonIncomplete:audit.incomplete,
   notice:"Private research only: no customer visibility, no operator price verification, no live commerce."
  },{headers:{"Cache-Control":"private, no-store"}});
  if(!input.reviewAcknowledged)throw Object.assign(new Error("Confirm that these are private, unverified research candidates."),{status:422});
  const canonical=JSON.stringify({
   label:input.sourceLabel,
   locations:input.locations.map(x=>[x.researchId,x.name,x.sourceUrl,x.observedAt]),
   prices:input.prices.map(x=>[x.itemId,x.itemName,x.onlineReferencePrice,x.priceSourceUrl])
  });
  const batchId="zw_research_"+digest(canonical),batchRef=db.collection("assistResearchBatches").doc(batchId);
  const existing=await batchRef.get();
  if(existing.exists)return Response.json({ok:true,mode:"stage",alreadyStaged:true,batchId,createdLocations:0,createdPrices:0},{headers:{"Cache-Control":"private, no-store"}});
  const batch=db.batch(),now=FieldValue.serverTimestamp();
  // Store all rows exclusively in private research collections. Never write
  // businesses, branches, products, orders, paymentIntents, or deliveryJobs.
  for(const l of input.locations){
   batch.create(db.collection("assistResearchLocations").doc(safeDocName(l.researchId)),{
    researchId:l.researchId,name:l.name,brandName:l.brandName||l.name,
    country:"ZW",city:l.city,area:l.area,address:l.address,phone:l.phone,
    category:l.category,sourceUrl:l.sourceUrl,sourceKind:l.sourceKind,
    sourceObservedAt:l.observedAt,reportedCoordinates:l.reportedCoordinates||null,
    status:"pending_identity_rights_review",public:false,operatorVerified:false,
    eligibleForPublication:false,needsDuplicateReview:true,
    possibleCanonicalMatches:audit.collisions.find(x=>x.researchId===l.researchId)?.possibleMatches||[],
    importBatchId:batchId,createdAt:now,updatedAt:now
   });
  }
  for(const p of input.prices){
   batch.create(db.collection("assistPriceResearch").doc(safeDocName(p.itemId)),{
    researchId:p.itemId,brand:p.brand,itemName:p.itemName,currency:"USD",
    onlineReferencePrice:p.onlineReferencePrice,priceSourceUrl:p.priceSourceUrl,
    sourceType:p.sourceType,sourceObservedAt:p.observedAt,
    priceCheckedAt:null,verifiedBranchId:null,merchantApproved:false,
    status:"source_reference_only",public:false,orderable:false,
    importBatchId:batchId,createdAt:now
   });
  }
  batch.create(batchRef,{
   country:"ZW",sourceLabel:input.sourceLabel,locationCount:input.locations.length,
   priceCount:input.prices.length,identityComparisonIncomplete:audit.incomplete,
   status:"staged_private_unverified",published:false,
   createdBy:actor.uid,createdAt:now
  });
  batch.create(db.collection("auditLogs").doc(),{
   action:"assist.research.staged",actorId:actor.uid,entityType:"assistResearchBatch",
   entityId:batchId,metadata:{locations:input.locations.length,prices:input.prices.length,comparisonIncomplete:audit.incomplete},
   createdAt:now
  });
  await batch.commit();
  return Response.json({ok:true,mode:"stage",batchId,createdLocations:input.locations.length,
   createdPrices:input.prices.length,comparisonIncomplete:audit.incomplete,
   publicListingsCreated:0,liveOrdersCreated:0
  },{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"The research batch has invalid or incomplete fields.",details:error.flatten()},{status:422});
  return apiError(error);
 }
}
