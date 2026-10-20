import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
import {verifiedAssistQuote,independentPaymentEnabled,cents} from "../lib/assist-money.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const q={state:"quote_accepted_awaiting_payment",paymentStatus:"not_initiated",
 finalQuote:{currency:"USD",merchandiseTotal:8,shoppingFee:2,deliveryFee:1,total:11,verifiedBy:"operator",note:"Staff verified each priced menu item",expiresAt:"2026-10-22T00:00:00Z"}};
test("Paynow collection stays off until separately cleared",()=>{
 assert.equal(independentPaymentEnabled({},{}),false);
 assert.equal(independentPaymentEnabled({assistFinance:{enabled:true,providerReviewed:true},independentShopping:{paymentCollectionEnabled:true}},{financeReady:true}),false);
 assert.equal(independentPaymentEnabled({assistFinance:{enabled:true,providerReviewed:true},independentShopping:{paymentCollectionEnabled:true}},{financeReady:false}),false);
 assert.equal(independentPaymentEnabled({assistFinance:{enabled:true,providerReviewed:true,driverDispatchEnabled:true,manualFloatAttestationEnabled:true},independentShopping:{paymentCollectionEnabled:true}},{financeReady:true}),true);
});
test("only valid itemized independently verified quotes may be charged",()=>{
 assert.equal(verifiedAssistQuote(q,Date.parse("2026-10-20T09:00:00Z")).total,11);
 assert.throws(()=>verifiedAssistQuote({...q,finalQuote:{...q.finalQuote,total:10}},Date.parse("2026-10-20T09:00:00Z")));
 assert.throws(()=>verifiedAssistQuote({...q,finalQuote:{...q.finalQuote,verifiedBy:null}},Date.parse("2026-10-20T09:00:00Z")));
 assert.throws(()=>verifiedAssistQuote(q,Date.parse("2026-10-23T00:00:00Z")));
 assert.throws(()=>cents(1.234));
});
test("independent provider callbacks never use merchant ledger or auto Driver dispatch",()=>{
 const route=read("app/api/payments/paynow/result/route.js"),payment=read("lib/assist-payment-server.js");
 assert.ok(route.includes('model==="independent_shopping"'));
 assert.ok(payment.includes('assistMoneyLedger'));
 assert.ok(payment.includes('independent_customer_funds_liability'));
 for(const bad of ["dispatchDelivery(","postPaymentCapturedLedger(","collection(\"orders\")"])assert.equal(payment.includes(bad),false);
});
test("payment initiation requires current claim-safe store and separate finance signoff",()=>{
 const route=read("app/api/customer/independent-shopping/pay/route.js");
 for(const value of ["independentPaymentEnabled","independentStoreSafe","regionalServicePolicy","verifiedAssistQuote"])assert.ok(route.includes(value));
 assert.ok(route.includes('paymentCaptured:finalized.captured,dispatchCreated:false'));
 assert.ok(route.includes('intent.data().status==="paid"&&snap.data().paymentStatus==="paid_held"'));
 assert.ok(route.includes('A previous payment attempt needs provider reconciliation')||route.includes('This payment attempt needs provider reconciliation'));
});

test("customer checkout exposes Paynow only after distinct finance and store readiness",()=>{
 const source=read("app/api/customer/independent-shopping/requests/route.js");
 const app=read("components/independent-shopping-app.js");
 assert.ok(source.includes("independentPaymentEnabled"));
 assert.ok(source.includes('state==="quote_accepted_awaiting_payment"'));
 assert.ok(source.includes("paymentAvailable"));
 assert.ok(app.includes('if(!entry.paymentAvailable)'));
 assert.ok(app.includes('startAssistPayment(entry)'));
 assert.ok(app.includes("paynow.co.zw"));
 assert.ok(app.includes("/api/customer/independent-shopping/pay/status"));
 assert.ok(app.includes("No shopper has been dispatched"));
});
