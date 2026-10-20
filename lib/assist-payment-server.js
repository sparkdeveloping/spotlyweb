import "server-only";
import {FieldValue} from "firebase-admin/firestore";
import {paymentCallbackKey,canTransitionPayment} from "@/lib/payment-state";
import {notifyUser} from "@/lib/notification-server";
import {cents} from "@/lib/assist-money";

/** Paynow updates for unaffiliated purchases: liability ledger, no merchant/order/Driver side effects. */
export async function applyAssistPaymentUpdate(db,reference,normalized,{source="paynow_webhook",messaging=null,auth=null}={}){
 const intentRef=db.collection("paymentIntents").doc(reference);
 const callbackRef=db.collection("paymentCallbacks").doc(paymentCallbackKey({reference,providerReference:normalized.providerReference,providerStatus:normalized.providerStatus,amount:normalized.amount}));
 const outcome=await db.runTransaction(async tx=>{
   const [callback,intent]=await Promise.all([tx.get(callbackRef),tx.get(intentRef)]);
   if(callback.exists)return {deduplicated:true,...callback.data().result};
   if(!intent.exists||intent.data().model!=="independent_shopping")throw Object.assign(new Error("Independent payment intent not found."),{status:404});
   const data=intent.data(),requestRef=db.collection("independentShoppingRequests").doc(data.independentRequestId);
   const request=await tx.get(requestRef);
   if(!request.exists||request.data().paymentIntentReference!==reference||request.data().customerId!==data.customerId)
     throw Object.assign(new Error("The quoted purchase does not match its payment intent."),{status:409});
   const old=data.status||"initiated",actual=Number(normalized.amount);
   const amountOK=Number.isFinite(actual)&&actual>0&&Math.abs(cents(Number(data.amount))-cents(actual))<=1;
   let next=!amountOK&&normalized.paid?"amount_mismatch":normalized.paid?"paid":normalized.state||"pending";
   if(!["paid","failed","expired","cancelled","pending","amount_mismatch","refunded"].includes(next))next="pending";
   if(!canTransitionPayment(old,next))next=old;
   const changed=next!==old;
   const now=FieldValue.serverTimestamp(),wasPaid=old==="paid";
   const isCapture=next==="paid"&&!wasPaid&&amountOK&&request.data().state==="quote_accepted_awaiting_payment";
   const anomaly=Boolean((normalized.paid&&!amountOK)||(next==="paid"&&!isCapture&&!wasPaid));
   if(changed)tx.update(intentRef,{status:next,providerStatus:normalized.providerStatus||"unknown",providerReference:normalized.providerReference||"",updatedAt:now});
   if(isCapture){
     tx.update(requestRef,{state:"funded_awaiting_shopper",paymentStatus:"paid_held",fundedAmount:Number(data.amount),fundedAt:now,dispatchStatus:"not_dispatched",updatedAt:now});
     tx.create(db.collection("assistMoneyLedger").doc("capture_"+reference),{
       requestId:request.id,paymentIntentReference:reference,currency:"USD",amount:Number(data.amount),
       debitAccount:"paynow_provider_clearing",creditAccount:"independent_customer_funds_liability",
       source,type:"provider_capture",status:"posted",createdAt:now
     });
   }else if(next==="amount_mismatch"||anomaly){
     tx.set(db.collection("assistFinanceIssues").doc("provider_"+reference),{
       requestId:request.id,reference,status:"open",type:!amountOK?"amount_mismatch":"late_or_unexpected_capture",
       providerStatus:normalized.providerStatus||"unknown",expectedAmount:Number(data.amount),
       observedAmount:Number.isFinite(actual)?actual:null,updatedAt:now,createdAt:now
     },{merge:true});
     tx.update(requestRef,{paymentStatus:"payment_review_required",updatedAt:now});
   }else if(changed&&["failed","expired","cancelled"].includes(next)&&!wasPaid){
     tx.update(requestRef,{paymentStatus:next,updatedAt:now});
   }
   const result={state:next,captured:isCapture,deduplicated:false,anomaly,transitionApplied:changed};
   tx.create(callbackRef,{model:"independent_shopping",reference,source,providerStatus:normalized.providerStatus||"unknown",result,createdAt:now});
   return {...result,customerId:data.customerId,requestId:request.id};
 });
 if(outcome.captured&&messaging&&auth)await notifyUser({db,messaging,auth,userId:outcome.customerId,
   title:"Spotly Assist payment received",body:"Your independent purchase funds are held. A shopper has not been dispatched.",
   workspace:"customer",href:"/shop-for-me",category:"assist_shopping",module:"spotly_assist",
   eventType:"assist.payment.funded",entityType:"independentShoppingRequest",entityId:outcome.requestId}).catch(()=>{});
 return outcome;
}
