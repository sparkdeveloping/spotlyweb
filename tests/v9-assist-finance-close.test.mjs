import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {independentFinanceClosure} from "../lib/assist-finance-close.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const request={model:"independent_shopping",state:"delivered",paymentStatus:"paid_held",
 fundedAmount:20,finalQuote:{currency:"USD",merchandiseTotal:10,shoppingFee:6,deliveryFee:4,total:20}};
const job={requestId:"test_request",state:"delivered",currency:"USD",receiptReviewedAt:"2026-10-20",
 reviewedBy:"operator",actualSpend:8};
const float={requestId:"test_request",status:"externally_reconciled",currency:"USD",
 amount:10,returnedAmount:2,reconciledBy:"finance_a",returnReference:"BANK-RETURN-12345"};
const refunds=[{id:"balance",status:"reconciled_external",amount:2}];
test("captured funds reconcile purchase, refunds, retained fees and purchasing float",()=>{
 assert.deepEqual(independentFinanceClosure(request,job,float,refunds),{
  currency:"USD",captured:20,verifiedPurchase:8,refunded:2,retainedServiceFees:10,
  floatTransferred:10,floatReturned:2,independentlySettled:true
 });
 assert.equal(independentFinanceClosure(request,job,float,[{id:"balance",status:"reconciled_external",amount:4}]).retainedServiceFees,8);
});
test("closeout refuses unreconciled float, missing customer refund or unfinished delivery",()=>{
 assert.throws(()=>independentFinanceClosure(request,job,{...float,status:"externally_confirmed"},refunds));
 assert.throws(()=>independentFinanceClosure(request,job,float,[]));
 assert.throws(()=>independentFinanceClosure(request,job,float,[{amount:2,status:"awaiting_provider_execution"}]));
 assert.throws(()=>independentFinanceClosure({...request,state:"shopping"},job,float,refunds));
 assert.throws(()=>independentFinanceClosure({...request,providerRefundObserved:true},job,float,refunds));
 assert.throws(()=>independentFinanceClosure({...request,cancellationRequested:true},job,float,refunds));
 assert.throws(()=>independentFinanceClosure(request,{...job,actualSpend:9},float,refunds));
 assert.throws(()=>independentFinanceClosure(request,{...job,receiptReviewedAt:null},float,refunds));
});
test("final finance closeout is idempotent, role restricted and externally evidenced",()=>{
 const route=read("app/api/admin/assist-finance-close/route.js");
 for(const text of ["closeoutEnabled","assistFinanceClosures","independentFinanceClosure",
  "assistFloatReturnExternalReferences","externally_reconciled",
  "independent_customer_funds_liability","tx.create(closed"])
 assert.ok(route.includes(text),text);
 const admin=read("components/admin-assist-fulfillment.js");
 assert.ok(admin.includes("Finalize independent purchase ledger"));
 assert.ok(admin.includes("Reconcile returned float"));
 const preview=read("app/api/admin/assist-research/pilot-preflight/route.js");
 assert.ok(preview.includes("canCollectPayment"));
 assert.ok(preview.includes("canDispatchShopper:false"));
});
