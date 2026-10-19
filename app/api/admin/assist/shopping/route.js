import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { assistLocationEnabled } from "@/lib/spotly-assist";
import { independentPublicStore } from "@/lib/independent-shopping";

export const runtime = "nodejs";
const price = z.object({ itemId: z.string().min(2).max(80), unitPrice: z.number().finite().min(0).max(100000) }).strict();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), requestId: z.string().min(3).max(210),
    prices: z.array(price).min(1).max(25), shoppingFee: z.number().finite().min(0).max(1000),
    deliveryFee: z.number().finite().min(0).max(1000), reservePercent: z.number().min(0).max(30).default(12),
    validMinutes: z.number().int().min(5).max(120).default(30) }).strict(),
  z.object({ action: z.literal("authorize_checkout"), deliveryJobId: z.string().min(3).max(180) }).strict()
]);
const amount = (v) => Math.round(Number(v || 0) * 100) / 100;
export async function POST(request) {
  try {
    const actor = await authenticateRequest(request);
    requirePlatformPermission(actor,"operations.manage",{roles:["super_admin","platform_admin","operations_manager","dispatcher"]});
    const input = schema.parse(await request.json());
    const {db}=getAdminServices();
    if(input.action==="authorize_checkout"){
      const ref=db.collection("deliveryJobs").doc(input.deliveryJobId);
      let orderId="";
      await db.runTransaction(async(tx)=>{
        const snap=await tx.get(ref);
        if(!snap.exists)throw Object.assign(new Error("Shopping delivery not found."),{status:404});
        const job=snap.data();
        if(job.assistMode!=="independent_shopping"||job.fulfilmentMode!=="driver_shops")throw Object.assign(new Error("This action is only for independent shopping."),{status:409});
        if(job.state!=="shopping_review"||!job.assignedDriverId)throw Object.assign(new Error("Wait until the assigned shopper completes the shopping review."),{status:409});
        const orderRef=db.collection("orders").doc(job.orderId);
        const orderSnap=await tx.get(orderRef);
        if(!orderSnap.exists||orderSnap.data().paymentStatus!=="paid")throw Object.assign(new Error("The customer's payment must be confirmed before checkout."),{status:409});
        const projected=amount(job.shopping?.projectedSubtotal);
        const authorized=amount(job.shopping?.maxAuthorizedMerchandise);
        if(projected>authorized+0.001)throw Object.assign(new Error("The current basket exceeds the prepaid spending limit."),{status:422});
        if(!job.shopping?.checkoutAuthorizedAt)tx.set(ref,{
          "shopping.checkoutAuthorizedAt":FieldValue.serverTimestamp(),
          "shopping.checkoutAuthorizedByAdminId":actor.uid,
          updatedAt:FieldValue.serverTimestamp()
        },{merge:true});
        orderId=job.orderId;
      });
      await db.collection("auditLogs").add({actorId:actor.uid,action:"assist.shopping.checkout_authorized",entityType:"deliveryJob",entityId:input.deliveryJobId,metadata:{orderId},createdAt:FieldValue.serverTimestamp()});
      return Response.json({ok:true,authorized:true,deliveryJobId:input.deliveryJobId});
    }
    const requestRef=db.collection("independentShoppingRequests").doc(input.requestId);
    const requestSnap=await requestRef.get();
    if(!requestSnap.exists)throw Object.assign(new Error("Request not found."),{status:404});
    const entry=requestSnap.data();
    if(!["pending_manual_quote","contacting_business","awaiting_customer"].includes(entry.state))
      throw Object.assign(new Error("This request cannot be quoted in its current state."),{status:409});
    if(entry.orderId)throw Object.assign(new Error("An order already exists for this request."),{status:409});
    const [storeSnap, settingsSnap] = await Promise.all([
      db.collection("independentShoppingStores").doc(entry.storeId).get(),
      db.collection("platformSettings").doc("global").get()
    ]);
    const store=storeSnap.exists?independentPublicStore(storeSnap.id,storeSnap.data()):null;
    const settings=settingsSnap.data()||{};
    if(!store||!assistLocationEnabled(storeSnap.data(),settings))throw Object.assign(new Error("This location is not currently eligible for assisted shopping."),{status:409});
    const coords=storeSnap.data()?.pickupCoordinates;
    if(!coords||!Number.isFinite(Number(coords.lat))||!Number.isFinite(Number(coords.lng)))throw Object.assign(new Error("Set a verified pickup pin for this business before requesting a funded purchase."),{status:422});
    if(entry.country!=="ZW"&&store.country!=="ZW")throw Object.assign(new Error("Funded assisted checkout is not yet configured for this country's payment provider."),{status:503});
    const priced=new Map(input.prices.map((item)=>[item.itemId,item.unitPrice]));
    if(priced.size!==input.prices.length||priced.size!==(entry.items||[]).length)throw Object.assign(new Error("Confirm a price for each distinct requested item."),{status:422});
    const allowed=new Map(store.items.map((item)=>[item.id,item]));
    const items=(entry.items||[]).map((item)=>{
      if(!allowed.has(item.itemId)||!priced.has(item.itemId))throw Object.assign(new Error("An item changed or its price is no longer current."),{status:409});
      return {itemId:item.itemId,name:allowed.get(item.itemId).name,quantity:item.quantity,
        unitPrice:amount(priced.get(item.itemId)),lineTotal:amount(item.quantity*priced.get(item.itemId))};
    });
    const subtotal=amount(items.reduce((sum,item)=>sum+item.lineTotal,0));
    const reserve=amount(subtotal*input.reservePercent/100);
    const confirmedQuote={
      currency:store.country==="MW"?"MWK":"USD",items,merchandiseSubtotal:subtotal,
      shoppingFee:amount(input.shoppingFee),deliveryFee:amount(input.deliveryFee),
      reservePercent:input.reservePercent,reserveAmount:reserve,
      totalAuthorized:amount(subtotal+input.shoppingFee+input.deliveryFee+reserve),
      maxAuthorizedMerchandise:amount(subtotal+reserve),
      pickup:{lat:Number(coords.lat),lng:Number(coords.lng),address:store.address,
        city:store.city,country:store.country},
      confirmedBy:actor.uid,quotedAt:new Date().toISOString(),
      expiresAt:new Date(Date.now()+input.validMinutes*60000).toISOString()
    };
    await db.runTransaction(async(tx)=>{
      const fresh=await tx.get(requestRef);
      if(!fresh.exists||fresh.data().orderId||!["pending_manual_quote","contacting_business","awaiting_customer"].includes(fresh.data().state))
        throw Object.assign(new Error("This request changed while the quote was prepared."),{status:409});
      tx.set(requestRef,{state:"awaiting_customer",confirmedQuote,
        customerMessage:"Your independently purchased basket has been repriced. Review the full authorized amount before paying.",
        quotedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.uid},{merge:true});
      tx.create(db.collection("assistEvents").doc(),{entityId:requestRef.id,kind:"shopping",action:"quote_confirmed",actorId:actor.uid,
        nextState:"awaiting_customer",amount:confirmedQuote.totalAuthorized,currency:confirmedQuote.currency,createdAt:FieldValue.serverTimestamp()});
    });
    return Response.json({ok:true,state:"awaiting_customer",confirmedQuote});
  } catch(error) {
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review every confirmed price and the shopping and delivery fees.",details:error.flatten()},{status:422});
    return apiError(error);
  }
}
