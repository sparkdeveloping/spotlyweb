import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {enforceRateLimit} from "@/lib/rate-limit-server";

export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","finance_admin"];
const mimeTypes=new Set(["application/pdf","image/png","image/jpeg","image/webp"]);
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};

/** Private, authorized receipt download. No public Firebase Storage URL is issued. */
export async function GET(request){
 try{
  const actor=await authenticateRequest(request,{roles});
  await enforceRateLimit(request,{key:"assist-admin-receipt",limit:30,windowMs:3600000,identity:actor.uid});
  const requestId=new URL(request.url).searchParams.get("requestId")||"";
  if(!/^[A-Za-z0-9_-]{12,250}$/.test(requestId))fail("Choose a valid shopping request.",422);
  const {db,storage}=getAdminServices();
  const [job,uploaded]=await Promise.all([
   db.collection("assistIndependentShoppingJobs").doc(requestId).get(),
   db.collection("assistReceiptUploads").doc(requestId).get()
  ]);
  if(!job.exists||!uploaded.exists||
     !["receipt_submitted","collected","en_route","delivered"].includes(job.data().state))
   fail("A submitted receipt is not available for review.",404);
  const path=uploaded.data().storagePath;
  if(!path||path!==job.data().receiptPath||
     typeof path!=="string"||!/^assist-shopping-receipts\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(jpg|png|webp|pdf)$/.test(path)||
     !mimeTypes.has(uploaded.data().contentType)||uploaded.data().bytes>5*1024*1024)
   fail("The receipt evidence does not match the authorized shopping job.");
  const [contents]=await storage.bucket().file(path).download();
  if(contents.length>5*1024*1024)fail("Receipt exceeds the authorized size.");
  const extension=path.split(".").pop();
  return new Response(contents,{headers:{
   "Content-Type":uploaded.data().contentType,
   "Content-Disposition":"attachment; filename=\"spotly-assist-receipt-"+requestId+"."+extension+"\"",
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"
  }});
 }catch(e){return apiError(e);}
}
