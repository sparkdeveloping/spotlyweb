import {randomUUID} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";
export const runtime="nodejs";
const ext={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
export async function POST(request){
 try{
  const user=await authenticateRequest(request);
  await enforceRateLimit(request,{key:"assist-receipt",limit:8,windowMs:3600000,identity:user.uid});
  const form=await request.formData(),requestId=String(form.get("requestId")||""),file=form.get("receipt");
  if(!/^[a-zA-Z0-9_-]{12,250}$/.test(requestId)||!file||typeof file.arrayBuffer!=="function"||!ext[file.type]||file.size>5*1024*1024||file.size<100)
   return Response.json({ok:false,error:"Provide an image or PDF receipt under 5 MB for your assigned job."},{status:422});
  const {db,storage}=getAdminServices(),job=await db.collection("assistIndependentShoppingJobs").doc(requestId).get();
  if(!job.exists||job.data().driverId!==user.uid||job.data().state!=="shopping")
    throw Object.assign(new Error("Your shopping job is not ready for a receipt."),{status:409});
  const bytes=Buffer.from(await file.arrayBuffer()),path="assist-shopping-receipts/"+user.uid+"/"+requestId+"/"+randomUUID()+"."+ext[file.type];
  await storage.bucket().file(path).save(bytes,{resumable:false,metadata:{contentType:file.type,
    metadata:{requestId,driverId:user.uid,model:"independent_shopping"}}});
  await db.collection("assistReceiptUploads").doc(requestId).set({requestId,driverId:user.uid,storagePath:path,
    contentType:file.type,bytes:file.size,uploadedAt:FieldValue.serverTimestamp()});
  return Response.json({ok:true,storagePath:path,public:false});
 }catch(e){return apiError(e)}
}
