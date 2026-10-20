import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {authorizedRefundCapacity,refundCents,refundReadyForConfirmation,refundSummary} from "../lib/assist-refunds.js";
import {trustedPaynowUrl} from "../lib/assist-payment-url.js";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const request={model:"independent_shopping",paymentStatus:"paid_held",fundedAmount:27.50};
const first={id:"balance_req",requestId:"req",amount:5.50,currency:"USD",
 status:"external_evidence_submitted",externalReference:"BANK-RECEIPT-12345",
 evidenceUrl:"https://example.org/private/receipt.pdf",executedBy:"finance_1",
 requestedBy:"operations_1",executionNote:"Bank confirmed payment to original customer method."};

test("exact cents, refund reservations and double-count prevention",()=>{
 assert.equal(refundCents(2.35),235);
 assert.throws(()=>refundCents(2.351));
 assert.equal(authorizedRefundCapacity(request,[first]),22);
 assert.equal(authorizedRefundCapacity(request,[first],"balance_req"),27.50);
 assert.throws(()=>authorizedRefundCapacity({...request,paymentStatus:"pending"},[]));
 assert.throws(()=>authorizedRefundCapacity(request,[first,{id:"manual",status:"awaiting_provider_execution",amount:25}]));
});
test("refund evidence needs a second Finance reviewer and is bounded by funds",()=>{
 assert.equal(refundReadyForConfirmation(first,"finance_2",[first],request).amount,5.5);
 assert.throws(()=>refundReadyForConfirmation(first,"finance_1",[first],request));
 assert.throws(()=>refundReadyForConfirmation({...first,status:"awaiting_provider_execution"},"finance_2",[first],request));
 assert.throws(()=>refundReadyForConfirmation({...first,amount:30},"finance_2",[first],request));
 assert.throws(()=>refundReadyForConfirmation({...first,evidenceUrl:""},"finance_2",[first],request));
});
test("pending and externally reconciled refunds are separately presented",()=>{
 assert.deepEqual(refundSummary([{amount:4,status:"awaiting_provider_execution"},
  {amount:2,status:"reconciled_external"}]),{pending:4,reconciled:2,status:"awaiting_provider_reconciliation"});
 assert.equal(refundSummary([{amount:3,status:"reconciled_external"}]).status,"reconciled_external");
});
test("external refund references are unique; no merchant payment or false provider refund calls",()=>{
 const route=read("app/api/admin/assist-refunds/route.js");
 for(const phrase of ["assistRefundExternalReferences","tx.create(uniqueRef","independent_two_person_external_evidence",
   "refundReadyForConfirmation","assistMoneyLedger","refundReconciliationEnabled","reconciled_external"])
   assert.ok(route.includes(phrase),phrase);
 assert.equal(route.includes("paynow.refund("),false);
 assert.equal(route.includes("collection(\"orders\")"),false);
});
test("customer cancellation and failed shopping require financial review",()=>{
 const customer=read("app/api/customer/independent-shopping/requests/respond/route.js");
 const operations=read("app/api/admin/assist-fulfillment/route.js");
 const driver=read("app/api/driver/assist-shopping/route.js");
 assert.ok(customer.includes('decision==="request_cancel"'));
 assert.ok(customer.includes("cancelled_pending_refund"));
 assert.ok(customer.includes("cancellationRequested:true"));
 assert.ok(operations.includes("terminate_incident"));
 assert.ok(operations.includes("terminated_shopping_funds_review"));
 assert.ok(driver.includes("incident_paused"));
 assert.ok(driver.includes("report_issue"));
 assert.ok(driver.includes("driverDispatchEnabled!==true"));
});

test("provider polling and redirect URLs cannot reference arbitrary external servers",()=>{
 assert.equal(trustedPaynowUrl("https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc"),true);
 assert.equal(trustedPaynowUrl("https://paynow.co.zw/Payment/ConfirmPayment/abc",{kind:"redirect"}),true);
 for(const bad of ["http://www.paynow.co.zw/Interface/CheckPayment/",
  "https://www.paynow.co.zw.evil.com/Interface/CheckPayment/",
  "https://www.paynow.co.zw@evil.com/Interface/CheckPayment/",
  "https://paynow.co.zw:444/Interface/CheckPayment/",
  "https://www.paynow.co.zw/any-other-endpoint"])
  assert.equal(trustedPaynowUrl(bad),false,bad);
 const result=read("app/api/payments/paynow/result/route.js");
 const poll=read("app/api/customer/independent-shopping/pay/status/route.js");
 const start=read("app/api/customer/independent-shopping/pay/route.js");
 assert.ok(result.includes("trustedPaynowUrl(normalized.pollUrl)"));
 assert.ok(poll.includes("trustedPaynowUrl(intent.data().pollUrl)"));
 assert.ok(start.includes("trustedPaynowUrl(response.pollUrl)"));
});

test("customer cancellation pauses pre-purchase jobs and blocks further shopping",()=>{
 const customer=read("app/api/customer/independent-shopping/requests/respond/route.js");
 const driver=read("app/api/driver/assist-shopping/route.js");
 const admin=read("app/api/admin/assist-fulfillment/route.js");
 assert.ok(customer.includes('const pauseShopping=!safeImmediate&&job.exists'));
 assert.ok(customer.includes('tx.update(jobRef,{state:"incident_paused"'));
 assert.ok(driver.includes("q.cancellationRequested"));
 assert.ok(driver.includes("Operations must review before any further purchasing."));
 assert.ok(admin.includes('"financial_resolution_pending"'));
});
