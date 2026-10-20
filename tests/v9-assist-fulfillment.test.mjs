import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cost,pinHash,matchesPin,canShop} from "../lib/assist-fulfillment.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("customer funds and independent float must exist before assigning a shopper",()=>{
 const req={id:"x",state:"funded_awaiting_shopper",paymentStatus:"paid_held",finalQuote:{merchandiseTotal:10}};
 assert.equal(canShop(req,{},{}),false);
 assert.equal(canShop(req,{assistFinance:{driverDispatchEnabled:true}},{status:"externally_confirmed",requestId:"x",currency:"USD",amount:10}),true);
 assert.equal(canShop(req,{assistFinance:{driverDispatchEnabled:true}},{status:"externally_confirmed",requestId:"x",currency:"USD",amount:5}),false);
});
test("receipt cost is precise, substitution must be approved and no overcharge",()=>{
 assert.equal(cost([{status:"found",actualQuantity:2,actualUnitPrice:3.5},{status:"unavailable"}]),7);
 assert.throws(()=>cost([{status:"substitution_pending"}]));
 assert.throws(()=>cost([{status:"found",actualQuantity:1,actualUnitPrice:1.234}]));
});
test("handoff PIN is bound to the request, not exposed to the Driver",()=>{
 const hash=pinHash("request_1","123456");
 assert.equal(matchesPin("request_1","123456",hash),true);
 assert.equal(matchesPin("request_2","123456",hash),false);
 const driver=read("app/api/driver/assist-shopping/route.js");
 assert.ok(driver.includes("matchesPin"));
 assert.equal(driver.includes("customerDeliveryPin"),false);
});
test("independent receipt and refunds are isolated from merchant orders",()=>{
 const admin=read("app/api/admin/assist-fulfillment/route.js");
 for(const k of ["assistShopperFloatTransfers","assistIndependentShoppingJobs","assistMoneyLedger","assistRefundRequests"])assert.ok(admin.includes(k));
 for(const k of ['collection("orders")','collection("deliveryJobs")','postPaymentCapturedLedger','dispatchDelivery('])assert.equal(admin.includes(k),false);
 assert.ok(admin.includes("customerRefundIssued:false"));
});
test("customer approves substitutions and server verifies receipt upload",()=>{
 const subst=read("app/api/customer/independent-shopping/substitution/route.js");
 const upload=read("app/api/driver/assist-shopping/receipt/route.js");
 assert.ok(subst.includes('customerId!==actor.uid'));
 assert.ok(upload.includes("storage.bucket().file(path).save"));
});
