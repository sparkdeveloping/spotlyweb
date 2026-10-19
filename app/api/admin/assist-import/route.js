import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
export const runtime="nodejs";
const operatorRoles=["super_admin","platform_admin","operations_manager","data_import_manager"];
const recordSchema=z.object({
 name:z.string().trim().min(2).max(160),
 category:z.string().trim().min(2).max(90),
 country:z.string().trim().regex(/^[A-Z]{2}$/),
 city:z.string().trim().min(2).max(100),
 area:z.string().trim().max(120).default(""),
 address:z.string().trim().min(5).max(350),
 phone:z.string().trim().max(45).default(""),
 lat:z.number().min(-90).max(90).optional(),
 lng:z.number().min(-180).max(180).optional()
}).strict();
const schema=z.object({
 mode:z.enum(["preview","commit"]),
 source:z.enum(["staff_in_person","staff_phone","licensed_dataset"]),
 sourceReference:z.string().trim().min(2).max(300),
 rightsConfirmed:z.literal(true),
 rows:z.array(recordSchema).min(1).max(50)
}).strict();
const normal=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const key=r=>[r.country,normal(r.city),normal(r.name),normal(r.address)].join("|");
const idFor=r=>"spotlyassist_"+createHash("sha256").update(key(r)).digest("hex").slice(0,24);
export async function POST(request){
 try{
  const actor=await authenticateRequest(request,{roles:operatorRoles}),input=schema.parse(await request.json());
  const {db}=getAdminServices();
  const existing=await db.collection("businesses").where("public","==",true).limit(1000).get();
  const normalizedExisting=new Set(existing.docs.map(d=>key({...d.data(),country:d.data().country||"ZW"})));
  const ids=new Set();
  const previews=input.rows.map((row)=>{
    const id=idFor(row),duplicateImport=ids.has(key(row)),alreadyListed=normalizedExisting.has(key(row));
    ids.add(key(row));
    return {...row,id,outcome:duplicateImport?"duplicate_in_batch":alreadyListed?"already_exists":"new"};
  });
  const approved=previews.filter(p=>p.outcome==="new");
  const rejected=previews.filter(p=>p.outcome!=="new");
  if(input.mode==="preview")return Response.json({ok:true,mode:"preview",newCount:approved.length,duplicateCount:rejected.length,records:previews});
  if(rejected.length)throw Object.assign(new Error("Please remove or resolve duplicate listings before committing this batch."),{status:409});
  const batch=db.batch(),now=FieldValue.serverTimestamp(),batchId=db.collection("assistImportBatches").doc().id;
  for(const record of approved){
    const ref=db.collection("businesses").doc(record.id);
    const payload={
      name:record.name,brandName:record.name,category:record.category,categories:[record.category],
      businessType:/restaurant|food|cafe|bakery|takeaway/i.test(record.category)?"restaurant_food":/salon|spa|barber|beauty|fitness|service/i.test(record.category)?"appointments_services":"directory_profile",
      country:record.country,city:record.city,area:record.area,address:record.address,phone:record.phone,
      ...(record.lat!==undefined&&record.lng!==undefined?{latitude:record.lat,longitude:record.lng}:{}),
      public:true,status:"provisional",claimStatus:"unclaimed",ownershipStatus:"unclaimed",verificationStatus:"unverified",
      commerceVerificationStatus:"not_verified",commerceVerified:false,commerceEnabled:false,assistAccepting:true,
      capabilities:["discover","claim"],fulfilment:[],
      description:record.name+" is listed for discovery. Spotly Assist may help arrange eligible requests independently; business affiliation is not implied.",
      source:{type:"spotly_assist_import",rightsStatus:"spotly_created",origin:input.source,reference:input.sourceReference,importBatchId:batchId,recordedBy:actor.uid},
      createdAt:now,updatedAt:now
    };
    batch.create(ref,payload);
  }
  batch.create(db.collection("assistImportBatches").doc(batchId),{source:input.source,sourceReference:input.sourceReference,createdBy:actor.uid,count:approved.length,ids:approved.map(i=>i.id),countryCodes:[...new Set(approved.map(i=>i.country))],createdAt:now});
  batch.create(db.collection("auditLogs").doc(),{action:"assist.import.committed",actorId:actor.uid,entityType:"assistImportBatch",entityId:batchId,metadata:{count:approved.length,source:input.source},createdAt:now});
  await batch.commit();
  return Response.json({ok:true,mode:"commit",batchId,created:approved.length,skipped:0,ids:approved.map(i=>i.id)});
 }catch(error){if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the source, licensing attestation and business data.",details:error.flatten()},{status:422});return apiError(error);}
}
