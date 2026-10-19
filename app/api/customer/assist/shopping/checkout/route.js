import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { haversineKm, makeCode, makeDeliveryNumber } from "@/lib/driver-delivery-server";
import { buildOrderTotals } from "@/lib/order-money";
import { assistLocationEnabled } from "@/lib/spotly-assist";
import { independentPublicStore } from "@/lib/independent-shopping";
import { enforceRateLimit } from "@/lib/rate-limit-server";

export const runtime="nodejs";
const schema=z.object({
  requestId:z.string().min(12).max(210),
  delivery:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),
    address:z.string().trim().min(10).max(400),suburb:z.string().max(120).default(""),
    landmark:z.string().max(240).default(""),instructions:z.string().max(500).default("")}).strict(),
  substitutionPreference:z.enum(["contact_me","no_substitutions","best_match"]).default("contact_me")
}).strict();
const amount=(v)=>Math.round(Number(v||0)*100)/100;
export async function POST(request){
  try {
    const user=await authenticateRequest(request);
    const body=schema.parse(await request.json());
    await enforceRateLimit(request,{key:"assist-shopping-checkout",limit:8,windowMs:60*60000,identity:user.uid});
    const {db}=getAdminServices();
    const requestRef=db.collection("independentShoppingRequests").doc(body.requestId);
    const quoteSnap=await requestRef.get();
    if(!quoteSnap.exists||quoteSnap.data().customerId!==user.uid)throw Object.assign(new Error("This quote was not found."),{status:404});
    const record=quoteSnap.data();
    const quote=record.confirmedQuote;
    if(record.orderId) {
      const old=await db.collection("orders").doc(record.orderId).get();
      if(old.exists&&old.data().customerId===user.uid)
        return Response.json({ok:true,orderId:old.id,paymentRequired:!["paid","refunded"].includes(old.data().paymentStatus),idempotent:true});
      throw Object.assign(new Error("This request is already being processed."),{status:409});
    }
    if(record.state!=="awaiting_customer"||!quote||Date.parse(quote.expiresAt)<=Date.now())
      throw Object.assign(new Error("This quote expired or is no longer awaiting approval. Ask Spotly to check the current prices."),{status:409});
    if(quote.currency!=="USD"||record.country!=="ZW")throw Object.assign(new Error("This country's independent-shopping payment provider is not configured yet."),{status:503});
    const [settingsSnap,storeSnap]=await Promise.all([
      db.collection("platformSettings").doc("global").get(),
      db.collection("independentShoppingStores").doc(record.storeId).get()
    ]);
    const settings=settingsSnap.data()||{};
    if (settings.independentShopping?.paidCheckoutEnabled !== true || settings.independentShopping?.shopperPurchaseFundingReady !== true) throw Object.assign(new Error("Shopping price requests are available, but funded purchases are not yet open in this area. No payment has been taken."), { status: 503 });
    const store=storeSnap.exists?independentPublicStore(storeSnap.id,storeSnap.data()):null;
    if(!store||!assistLocationEnabled(storeSnap.data(),settings))throw Object.assign(new Error("Independent shopping at this location has been paused."),{status:409});
    if(settings.integrations?.paynowEnabled!==true||!(settings.commerce?.paymentMethods||[]).includes("paynow"))
      throw Object.assign(new Error("Paynow checkout is unavailable. Your quote remains saved."),{status:503});
    if(!quote.pickup||![quote.pickup.lat,quote.pickup.lng].every((v)=>Number.isFinite(Number(v))))
      throw Object.assign(new Error("The store pickup location must be verified by Spotly before payment."),{status:409});
    const distance=haversineKm(quote.pickup,body.delivery);
    const maxKm=Number(settings.independentShopping?.maxDeliveryKm||15);
    if(!Number.isFinite(distance)||distance>maxKm)
      throw Object.assign(new Error("This delivery address is outside the currently supported independent-shopping area."),{status:422});
    const originalItems=new Map(store.items.map((item)=>[item.id,item]));
    const quotedItems=quote.items||[];
    if(!quotedItems.length||quotedItems.some((item)=>!originalItems.has(item.itemId)))
      throw Object.assign(new Error("Menu items changed. Request a refreshed quote."),{status:409});
    const subtotal=amount(quotedItems.reduce((sum,item)=>sum+amount(item.lineTotal),0));
    if(Math.abs(subtotal-Number(quote.merchandiseSubtotal||0))>0.01)
      throw Object.assign(new Error("The verified price quote is inconsistent."),{status:409});
    const totals=buildOrderTotals({subtotal,serviceFee:quote.shoppingFee,deliveryFee:quote.deliveryFee,
      shoppingReserve:quote.reserveAmount,commissionPercent:0});
    if(Math.abs(totals.total-Number(quote.totalAuthorized||0))>0.01)
      throw Object.assign(new Error("The authorized checkout total changed. Request a new quote."),{status:409});
    const orderRef=db.collection("orders").doc(`assist_${createHash("sha256").update(body.requestId).digest("hex").slice(0,34)}`);
    const jobRef=db.collection("deliveryJobs").doc(`assist_${createHash("sha256").update(body.requestId).digest("hex").slice(0,34)}`);
    const number=`AS-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${orderRef.id.slice(-6).toUpperCase()}`;
    const lines=quotedItems.map((item)=>({
      productId:item.itemId,name:item.name,quantity:item.quantity,unitPrice:item.unitPrice,
      lineTotal:item.lineTotal,image:"",substitutionAllowed:true
    }));
    const shopItems=lines.map((line)=>({
      productId:line.productId,name:line.name,image:"",requestedQuantity:line.quantity,
      estimatedUnitPrice:line.unitPrice,substitutionAllowed:true,status:"pending",
      actualQuantity:0,actualUnitPrice:0,replacementName:""
    }));
    const result=await db.runTransaction(async(tx)=>{
      const [fresh,existing]=await Promise.all([tx.get(requestRef),tx.get(orderRef)]);
      if(existing.exists){
        if(existing.data().customerId!==user.uid)throw Object.assign(new Error("Order ownership mismatch."),{status:403});
        return {orderId:orderRef.id,idempotent:true};
      }
      if(!fresh.exists||fresh.data().customerId!==user.uid||fresh.data().orderId||fresh.data().state!=="awaiting_customer"||
        fresh.data().confirmedQuote?.expiresAt!==quote.expiresAt||Date.parse(quote.expiresAt)<=Date.now())
        throw Object.assign(new Error("This quote changed while checkout was prepared."),{status:409});
      const now=FieldValue.serverTimestamp();
      tx.create(orderRef,{
        transactionType:"assist_shopping",number,customerId:user.uid,customerEmail:user.email||"",
        customerName:record.contactName,businessId:record.sourceBusinessId||storeSnap.data().directoryBusinessId,
        businessName:store.name,branchId:null,branchName:store.area||store.city,
        affiliation:"unaffiliated",assistRequestId:requestRef.id,
        currency:"USD",items:lines,totals,subtotal,fulfilment:"delivery",
        commerceSnapshot:{commissionPercent:0,settlementModel:"independent_purchase",deliveryFulfilmentMode:"driver_shops"},
        shopping:{mode:"driver_shops",fundingModel:"customer_prepaid_independent_purchase",state:"funding_pending",
          reservePercent:quote.reservePercent,estimatedSubtotal:subtotal,reserveAmount:quote.reserveAmount,
          maxAuthorizedMerchandise:quote.maxAuthorizedMerchandise,substitutionPreference:body.substitutionPreference,
          receiptStoragePath:"",changes:[]},
        delivery:{...body.delivery,contactName:record.contactName,contactPhone:record.contactPhone,
          substitutionPreference:body.substitutionPreference},
        paymentMethod:"paynow",paymentStatus:"unpaid",status:"awaiting_payment",
        merchantSettlementStatus:"not_applicable",inventoryReservationStatus:"released",
        deliveryJobId:jobRef.id,deliveryStatus:"awaiting_payment",
        timeline:[{status:"awaiting_payment",at:new Date().toISOString(),actorId:user.uid}],
        createdAt:now,updatedAt:now
      });
      tx.create(jobRef,{
        number:makeDeliveryNumber(),orderId:orderRef.id,assistRequestId:requestRef.id,
        businessId:record.sourceBusinessId||storeSnap.data().directoryBusinessId||null,
        branchId:null,customerId:user.uid,assistMode:"independent_shopping",
        fulfilmentMode:"driver_shops",state:"awaiting_payment",currency:"USD",
        pickup:{lat:quote.pickup.lat,lng:quote.pickup.lng,formattedAddress:quote.pickup.address||store.address,
          area:store.area||store.city,instructions:"Independent counter purchase; this store is not partnered with Spotly."},
        dropoff:{lat:body.delivery.lat,lng:body.delivery.lng,formattedAddress:body.delivery.address,
          suburb:body.delivery.suburb,landmark:body.delivery.landmark,instructions:body.delivery.instructions},
        deliveryDistanceKm:amount(distance),requiredVehicleTypes:["motorcycle","car"],shoppingMinutes:30,
        operatingProfile:{type:"grocery_shopping",archetype:"independent_purchase",chilled:false,fragile:false,bulky:false},
        shopping:{state:"funding_pending",reservePercent:quote.reservePercent,
          estimatedSubtotal:subtotal,reserveAmount:quote.reserveAmount,
          maxAuthorizedMerchandise:quote.maxAuthorizedMerchandise,
          substitutionPreference:body.substitutionPreference,items:shopItems,
          customerApprovalRequired:true},
        quotedDriverPay:Math.max(1,amount(Math.min(quote.deliveryFee,Number(settings.commerce?.defaultDriverPay||3)))),
        pickupCode:null,customerPin:makeCode(4),bagCount:1,createdAt:now,updatedAt:now
      });
      tx.set(requestRef,{
        state:"awaiting_payment",orderId:orderRef.id,deliveryJobId:jobRef.id,customerAcceptedAt:now,
        customerMessage:"You approved Spotly's confirmed quote. Complete digital payment to begin dispatch.",
        updatedAt:now
      },{merge:true});
      tx.create(db.collection("assistEvents").doc(),{entityId:requestRef.id,kind:"shopping",
        action:"customer_accepted_quote",actorType:"customer",actorId:user.uid,orderId:orderRef.id,
        createdAt:now});
      tx.create(db.collection("orderEvents").doc(),{orderId:orderRef.id,type:"order_created",
        status:"awaiting_payment",actorType:"customer",actorId:user.uid,source:"spotly_assist",
        metadata:{fulfilmentMode:"driver_shops",transactionType:"assist_shopping"},createdAt:now});
      return {orderId:orderRef.id,idempotent:false};
    });
    return Response.json({ok:true,...result,total:totals.total,currency:"USD",paymentRequired:true,
      nextAction:"paynow_initiate",message:"No shopper can begin purchasing until Paynow confirms the customer's funds."},
      {headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review your delivery map pin and substitution preferences.",details:error.flatten()},{status:422});
    return apiError(error);
  }
}
