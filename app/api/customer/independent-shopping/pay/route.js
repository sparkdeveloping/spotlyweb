import {randomUUID} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {z} from "zod";
import {apiError,authenticateRequest,getAdminServices} from "@/lib/firebase-admin";
import {createPaynow,normalizePaynowStatus} from "@/lib/paynow-server";
import {appUrl,normalizeZimbabwePhone} from "@/lib/server-helpers";
import {independentStoreSafe} from "@/lib/assist-store-safety";
import {independentShoppingFlags} from "@/lib/independent-shopping";
import {regionalServicePolicy} from "@/lib/v9-assist-regions";
import {verifiedAssistQuote,independentPaymentEnabled} from "@/lib/assist-money";
import {applyAssistPaymentUpdate} from "@/lib/assist-payment-server";
export const runtime="nodejs";
const schema=z.object({requestId:z.string().min(12).max(250),channel:z.enum(["web","ecocash","onemoney"]).default("web"),phone:z.string().max(40).optional()}).strict();
const fail=(m,s=409)=>{throw Object.assign(new Error(m),{status:s})};
export async function GET(request){
 try{
  const user=await authenticateRequest(request),id=new URL(request.url).searchParams.get("requestId")||"";
  if(id.length<12||id.length>250)fail("Select a valid Assist request.",422);
  const {db}=getAdminServices(),snap=await db.collection("independentShoppingRequests").doc(id).get();
  if(!snap.exists||snap.data().customerId!==user.uid)fail("Shopping request not found.",404);
  const data=snap.data();
  return Response.json({ok:true,requestId:id,state:data.state,paymentStatus:data.paymentStatus||"not_initiated",
   fundedAmount:data.fundedAmount||null,currency:data.finalQuote?.currency||"USD",
   paymentIntentReference:data.paymentIntentReference||null,merchantOrder:false,dispatchStatus:data.dispatchStatus||"not_dispatched"},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error)}
}
export async function POST(request){
 let ref=null,prepared=null,providerAccepted=false;
 try{
  const user=await authenticateRequest(request),body=schema.parse(await request.json());
  const {db,messaging,auth}=getAdminServices();
  ref=db.collection("independentShoppingRequests").doc(body.requestId);
  const settingsRef=db.collection("platformSettings").doc("global");
  prepared=await db.runTransaction(async tx=>{
   const [snap,settings]=await Promise.all([tx.get(ref),tx.get(settingsRef)]);
   if(!snap.exists||snap.data().customerId!==user.uid)fail("Shopping request not found.",404);
   const d=snap.data(),config=settings.data()||{};
   const quote=verifiedAssistQuote(d);
   const storeRef=db.collection("independentShoppingStores").doc(d.storeId);
   const storeSnap=await tx.get(storeRef);
   if(!storeSnap.exists)fail("This store is no longer accepting requests.");
   const store=storeSnap.data();
   if(!independentPaymentEnabled(config,store)||!independentShoppingFlags(config).requestEnabled)
      fail("Independent purchase payments are not enabled. Your quote can be reviewed without payment.",503);
   if(!regionalServicePolicy(config.assistCoverage||{},store,"eat").available)fail("Spotly Assist is not operating in this area.");
   const b=store.directoryBusinessId?await tx.get(db.collection("businesses").doc(store.directoryBusinessId)):null;
   const loc=store.sourceResearchBatchId&&store.directoryBranchId?await tx.get(db.collection("branches").doc(store.directoryBranchId)):null;
   if(!independentStoreSafe(store,b?.exists?b.data():null,loc?.exists?loc.data():null))fail("This independently sourced location is not currently eligible.");
   if(d.paymentIntentReference&&["initiated","pending"].includes(d.paymentStatus)){
    const old=await tx.get(db.collection("paymentIntents").doc(d.paymentIntentReference));
    if(old.exists&&old.data().status==="pending"&&(old.data().redirectUrl||old.data().instructions))
      return {reuse:true,reference:old.id,...old.data()};
    fail("Payment setup is already in progress. Check its status before retrying.");
   }
   const reference="SPOTLY-AS-"+randomUUID().replaceAll("-","").slice(0,28).toUpperCase();
   const intentRef=db.collection("paymentIntents").doc(reference);
   tx.create(intentRef,{
    model:"independent_shopping",reference,independentRequestId:body.requestId,orderId:null,businessId:null,
    customerId:user.uid,customerEmail:user.email||"",storeId:d.storeId,provider:"paynow",
    amount:quote.total,currency:quote.currency,breakdown:quote,channel:body.channel,
    status:"initiated",createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
   });
   tx.update(ref,{paymentIntentReference:reference,paymentStatus:"initiated",updatedAt:FieldValue.serverTimestamp()});
   return {reuse:false,reference,quote,storeId:d.storeId,email:user.email||"",requestId:body.requestId};
  });
  if(prepared.reuse)return Response.json({ok:true,reused:true,reference:prepared.reference,
   redirectUrl:prepared.redirectUrl||null,instructions:prepared.instructions||null,status:prepared.status});
  if(body.channel!=="web"&&!body.phone)fail("Provide the payment phone number.",422);
  const paynow=await createPaynow("USD"),base=appUrl(request);
  paynow.resultUrl=base+"/api/payments/paynow/result?currency=USD";
  paynow.returnUrl=base+"/shop-for-me?store="+encodeURIComponent(prepared.storeId);
  const payment=paynow.createPayment(prepared.reference,prepared.email||"customer@spotly.co.zw");
  payment.add("Independent Spotly shopping authorization",prepared.quote.total);
  const response=body.channel==="web"?await paynow.send(payment):
    await paynow.sendMobile(payment,normalizeZimbabwePhone(body.phone),body.channel);
  if(!response?.success)fail(response?.error||"Paynow could not create the purchase payment.",502);
  providerAccepted=true;
  const intentRef=db.collection("paymentIntents").doc(prepared.reference);
  await db.runTransaction(async tx=>{
   const [intent,snap]=await Promise.all([tx.get(intentRef),tx.get(ref)]);
   if(!intent.exists||!snap.exists||snap.data().paymentIntentReference!==prepared.reference)fail("The payment record changed unexpectedly.");
   tx.update(intentRef,{status:"pending",pollUrl:response.pollUrl||"",redirectUrl:response.redirectUrl||"",
     instructions:response.instructions||"",providerReference:response.paynowReference||"",updatedAt:FieldValue.serverTimestamp()});
   tx.update(ref,{paymentStatus:"pending",updatedAt:FieldValue.serverTimestamp()});
  });
  return Response.json({ok:true,reused:false,reference:prepared.reference,channel:body.channel,
   status:"pending",redirectUrl:response.redirectUrl||null,instructions:response.instructions||null,
   paymentCaptured:false,dispatchCreated:false});
 }catch(error){
  if(ref&&prepared&&!prepared.reuse){
   try{
    const {db}=getAdminServices();
    if(providerAccepted){
      await db.collection("assistFinanceIssues").doc("initiation_"+prepared.reference).set({
       reference:prepared.reference,requestId:prepared.requestId,status:"open",type:"provider_accepted_finalize_failed",
       detail:String(error.message||"").slice(0,250),createdAt:FieldValue.serverTimestamp()},{merge:true});
    }else{
      await db.collection("paymentIntents").doc(prepared.reference).set({status:"failed",initiationError:String(error.message||"").slice(0,250),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      await db.runTransaction(async tx=>{
       const snap=await tx.get(ref);
       if(snap.exists&&snap.data().paymentIntentReference===prepared.reference&&snap.data().paymentStatus==="initiated")
         tx.update(ref,{paymentStatus:"failed",updatedAt:FieldValue.serverTimestamp()});
      });
    }
   }catch{}
  }
  if(error instanceof z.ZodError)return Response.json({ok:false,error:"Check your independent purchase payment details."},{status:422});
  return apiError(error);
 }
}
