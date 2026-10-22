import { FieldPath } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { adminBusinessMatches, adminSafeBusiness } from "@/lib/admin-business-register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const querySchema = z.object({
  mode:z.enum(["list","account"]).default("list"),
  q:z.string().trim().max(140).default(""),
  email:z.string().trim().max(180).default(""),
  city:z.string().trim().max(80).default(""),
  source:z.string().trim().max(100).default(""),
  ownership:z.string().trim().max(50).default(""),
  verification:z.string().trim().max(50).default(""),
  publication:z.string().trim().max(50).default(""),
  commerce:z.string().trim().max(50).default(""),
  attention:z.string().trim().max(50).default(""),
  from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort:z.enum(["createdAt","updatedAt","name","id"]).default("createdAt"),
  direction:z.enum(["asc","desc"]).default("desc"),
  cursor:z.string().trim().max(220).default(""),
  limit:z.coerce.number().int().min(10).max(100).default(40)
});

function docRecords(snap) {return snap.docs.map(doc=>({id:doc.id,...doc.data()}));}
async function resolvePeople(db, records) {
  const ids=[...new Set(records.flatMap(b=>[b.createdBy,...(b.ownerIds || [])]).filter(Boolean))].slice(0,100);
  if(!ids.length)return {};
  const docs=await db.getAll(...ids.map(id=>db.collection("users").doc(id)));
  return Object.fromEntries(docs.map((doc,index)=>{
    const u=doc.data()||{};
    return [ids[index],{uid:ids[index],name:String(u.displayName||u.name||"").slice(0,100),
      email:String(u.email||"").slice(0,180)}];
  }));
}
async function listBusinesses(db, filters) {
  const collection=db.collection("businesses");
  const sort=filters.sort === "id" ? FieldPath.documentId() : filters.sort;
  const limit=filters.limit;
  // A bounded server-side scan supports multi-dimensional filters without
  // dozens of fragile composite Firestore indexes. Subsequent pages continue
  // from the exact last scanned document. Counts are NOT platform totals.
  let cursor=filters.cursor ? await collection.doc(filters.cursor).get() : null;
  if(cursor && !cursor.exists) throw Object.assign(new Error("Your page cursor expired. Refresh the register."),{status:400});
  const matched=[];
  let scanned=0, exhausted=false;
  const chunkSize=80;
  for(let page=0;page<4 && matched.length<limit;page++){
    let query=collection.orderBy(sort,filters.direction).limit(chunkSize);
    if(cursor)query=query.startAfter(cursor);
    const batch=await query.get();
    if(batch.empty){exhausted=true;break;}
    for(const doc of batch.docs){
      cursor=doc;scanned++;
      const item={id:doc.id,...doc.data()};
      if(adminBusinessMatches(item,filters))matched.push(adminSafeBusiness(doc.id,item));
      if(matched.length===limit) break;
    }
    if(batch.size<chunkSize){exhausted=true;break;}
  }
  // Account identity data is resolved only for returned rows, not every scan.
  return {rows:matched, scanned, nextCursor:exhausted?null:cursor?.id||null,
    hasMore:!exhausted, scannedOnly:true,
    people:await resolvePeople(db,matched),
    note:"Filters cover the records scanned. Use Next page to continue across the full register; visible counts are not platform-wide totals."};
}
async function accountBusinesses(db,auth,email) {
  if(!z.string().email().safeParse(email).success) throw Object.assign(new Error("Enter the account's full email address."),{status:400});
  let account;
  try {account=await auth.getUserByEmail(email.toLowerCase());}
  catch(error){
    if(error.code==="auth/user-not-found")return {account:null,rows:[],claims:[],people:{},note:"No Firebase account matches this email."};
    throw error;
  }
  const uid=account.uid;
  const [created,origin,owned,claims]=await Promise.all([
    db.collection("businesses").where("createdBy","==",uid).limit(100).get(),
    db.collection("businesses").where("source.createdBy","==",uid).limit(100).get(),
    db.collection("businesses").where("ownerIds","array-contains",uid).limit(100).get(),
    db.collection("businessClaims").where("applicantId","==",uid).limit(100).get()
  ]);
  const found=new Map();
  for(const [type,snap] of [["created",created],["created",origin],["owner",owned]]){
    for(const doc of snap.docs) {
      const old=found.get(doc.id)||{id:doc.id,data:doc.data(),relationships:[]};
      if(!old.relationships.includes(type))old.relationships.push(type);
      found.set(doc.id,old);
    }
  }
  const relatedClaims=claims.docs.map(doc=>({id:doc.id,businessId:doc.data().businessId||"",
    businessName:doc.data().businessName||"",status:doc.data().status||"unknown",
    createdAt:doc.data().createdAt?.toDate?.()?.toISOString?.()||null}));
  // Claims are not ownership. Return them distinctly from created/owned brands.
  const rows=[...found.values()].map(entry=>({...adminSafeBusiness(entry.id,entry.data),relationships:entry.relationships}));
  return {account:{uid,email:account.email||"",name:account.displayName||"",verified:account.emailVerified},
    rows,claims:relatedClaims,people:await resolvePeople(db,rows),
    incomplete:[created,origin,owned,claims].some(snap=>snap.size===100),
    note:"Created records, approved owner memberships and claims are separate relationships. A submitted claim does not prove ownership."};
}
export async function GET(request){
  try {
    const actor=await authenticateRequest(request);
    requirePlatformPermission(actor,"businesses.read",{roles:["operations_manager","regional_operations_manager","business_success_manager","verification_officer"]});
    await enforceRateLimit(request,{key:"admin_business_register",limit:45,windowMs:60000,identity:actor.uid});
    const raw=Object.fromEntries(new URL(request.url).searchParams);
    const result=querySchema.safeParse(raw);
    if(!result.success) return Response.json({ok:false,error:"Review search, date and sorting options."},{status:400});
    const {db,auth}=getAdminServices();
    const data=result.data.mode==="account"
      ? await accountBusinesses(db,auth,result.data.email)
      : await listBusinesses(db,result.data);
    return Response.json({ok:true,...data},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiError(error);}
}
