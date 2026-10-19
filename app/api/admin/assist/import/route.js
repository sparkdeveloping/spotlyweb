import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";

export const runtime = "nodejs";
const normalize = (value) => String(value || "").trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const itemSchema = z.object({
  name: z.string().trim().min(2).max(150),
  price: z.number().finite().min(0).max(100000),
  unit: z.string().trim().max(60).default(""),
  checkedAt: z.string().datetime({ offset: true })
}).strict();
const rowSchema = z.object({
  externalId: z.string().trim().min(3).max(160),
  name: z.string().trim().min(2).max(160),
  country: z.string().regex(/^[A-Z]{2}$/),
  city: z.string().trim().min(2).max(120),
  area: z.string().trim().max(120).default(""),
  address: z.string().trim().min(6).max(350),
  phone: z.string().trim().max(40).default(""),
  category: z.string().trim().min(2).max(90).default("Restaurant"),
  kind: z.enum(["restaurant","shop","service","directory"]),
  items: z.array(itemSchema).max(90).default([]),
  priceCheckMethod: z.enum(["in_person","phone","business_authorized"]).optional()
}).strict();
const schema = z.object({
  sourceId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,65}$/),
  sourceRights: z.enum(["independently_researched","business_authorized","licensed_data"]),
  sourceLicense: z.string().trim().max(180).default(""),
  mode: z.enum(["preview","commit"]).default("preview"),
  rows: z.array(rowSchema).min(1).max(60)
}).strict();

export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor, "businesses.manage", { roles: ["super_admin","platform_admin","data_import_manager","operations_manager"] });
    const body = schema.parse(await request.json());
    const { db } = getAdminServices();
    const normalizedRows = body.rows.map((row) => {
      const fingerprint = `${row.country}:${normalize(row.city)}:${normalize(row.name)}:${normalize(row.address)}`;
      const reference = createHash("sha256").update(`${body.sourceId}|${row.externalId}`).digest("hex").slice(0,26);
      return { ...row, fingerprint, reference };
    });
    if (new Set(normalizedRows.map((row)=>row.reference)).size !== normalizedRows.length) {
      throw Object.assign(new Error("Duplicate external identifiers in the import."), { status: 422 });
    }
    const [existingIds,existingNames] = await Promise.all([
      Promise.all(normalizedRows.map((row)=>db.collection("businesses").doc(`imp_${row.reference}`).get())),
      Promise.all([...new Set(normalizedRows.map((row)=>row.name))].map((name)=>db.collection("businesses").where("name","==",name).limit(35).get()))
    ]);
    const byName = new Map();
    [...new Set(normalizedRows.map((row)=>row.name))].forEach((name,i)=>byName.set(name,existingNames[i].docs));
    const report = normalizedRows.map((row,index) => {
      const current = existingIds[index].exists ? existingIds[index].data() : null;
      const fingerprintMatch = (byName.get(row.name)||[]).find((doc)=>
        doc.id!==`imp_${row.reference}` &&
        normalize(doc.data().city)===normalize(row.city) &&
        String(doc.data().country||"ZW")===row.country &&
        (normalize(doc.data().address)===normalize(row.address) || normalize(doc.data().area)===normalize(row.area)));
      let verdict = "create";
      if (current && (current.claimStatus==="claimed" || (current.ownerIds||[]).length || current.commerceVerified===true)) verdict="protected_skip";
      else if (current && current.source?.sourceId!==body.sourceId) verdict="source_conflict_skip";
      else if (fingerprintMatch) verdict="possible_duplicate_skip";
      else if (current) verdict="update_import";
      if (row.items.length && !row.priceCheckMethod) verdict="missing_price_check";
      const freshItems = row.items.filter((item) => {
        const at = Date.parse(item.checkedAt);
        return Number.isFinite(at) && at<=Date.now() && Date.now()-at<=14*86400000;
      });
      return { externalId: row.externalId, id: `imp_${row.reference}`, name: row.name,
        city: row.city, country: row.country, verdict,
        possibleDuplicateId: fingerprintMatch?.id || null,
        totalItems: row.items.length, freshItems: freshItems.length
      };
    });
    if (body.mode==="preview") return Response.json({ ok:true, mode:"preview", report, inserted:0,
      warning:"Preview only. Review duplicates and source rights before importing." });
    const accepted = report.filter((row)=>["create","update_import"].includes(row.verdict));
    const batchRef = db.collection("importBatches").doc();
    let committed = 0;
    const now = FieldValue.serverTimestamp();
    for(let offset=0;offset<accepted.length;offset+=20){
      const batch=db.batch();
      for(const summary of accepted.slice(offset,offset+20)){
        const row=normalizedRows.find((item)=>`imp_${item.reference}`===summary.id);
        const businessRef=db.collection("businesses").doc(summary.id);
        const old=existingIds[normalizedRows.indexOf(row)];
        const data = {
          name:row.name, brandName:row.name, country:row.country,city:row.city,area:row.area,
          address:row.address,phone:row.phone,category:row.category,categories:[row.category],
          businessType:row.kind==="service"?"appointments_services":row.kind==="restaurant"?"restaurant_food":row.kind==="shop"?"grocery_retail":"directory_profile",
          public:true,status:"provisional",lifecycleStatus:"listed",
          claimStatus:"unclaimed",verificationStatus:"unverified",commerceVerificationStatus:"not_verified",
          assistEnabled:true,fulfilment:[],ownerIds:[],
          source:{type:"admin_import",sourceId:body.sourceId,rightsStatus:body.sourceRights==="licensed_data"?"licensed":"spotly_created",license:body.sourceLicense},
          importBatchId:batchRef.id,updatedAt:now,updatedBy:actor.uid
        };
        if(!old.exists){data.createdAt=now;data.createdBy=actor.uid;}
        const safeItems = row.items.filter((item)=>Date.now()-Date.parse(item.checkedAt)<=14*86400000 && Date.parse(item.checkedAt)<=Date.now());
        if(safeItems.length && row.kind!=="directory"){
          const storeRef=db.collection("independentShoppingStores").doc(`import_${row.reference}`);
          const currency=row.country==="MW"?"MWK":"USD";
          batch.set(storeRef,{
            name:row.name,city:row.city,area:row.area,address:row.address,phone:row.phone,
            country:row.country,currency,category:row.category,directoryBusinessId:businessRef.id,
            status:"published",affiliation:"unaffiliated",sourcingModel:"independent_in_person",
            priceCheckMethod:row.priceCheckMethod,sourceId:body.sourceId,assistEnabled:true,
            items:safeItems.map((item,i)=>({id:`p_${i+1}`,name:item.name,unit:item.unit,category:"",priceEstimate:item.price,priceCheckedAt:item.checkedAt,status:"available"})),
            updatedBy:actor.uid,updatedAt:now
          },{merge:true});
          data.assistStoreId=storeRef.id;
        }
        batch.set(businessRef,data,{merge:true});
      }
      await batch.commit();committed+=Math.min(20,accepted.length-offset);
    }
    await batchRef.set({ sourceId:body.sourceId,sourceRights:body.sourceRights,
      sourceLicense:body.sourceLicense,importedBy:actor.uid,createdAt:now,
      countryCodes:[...new Set(body.rows.map((row)=>row.country))],requested:body.rows.length,committed,
      skipped:report.length-committed,report:report.slice(0,60)
    });
    return Response.json({ok:true,mode:"commit",committed,skipped:report.length-committed,report,batchId:batchRef.id});
  } catch(error) {
    if(error instanceof z.ZodError) return Response.json({ok:false,error:"Review country, city, original source information and price timestamps.",details:error.flatten()},{status:422});
    return apiError(error);
  }
}
