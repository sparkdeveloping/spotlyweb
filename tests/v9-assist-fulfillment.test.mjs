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
 const getResponse=driver.slice(driver.indexOf("export async function GET"),driver.indexOf("export async function POST"));
 assert.equal(getResponse.includes("customerDeliveryPin"),false);
 assert.ok(driver.includes('action:z.enum(["accept","reject","start"'));
 assert.ok(driver.includes('driverDispatchEnabled!==true'));
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

test("driver offer acceptance, decline and safe reassignment are supported",()=>{
 const driver=read("app/api/driver/assist-shopping/route.js");
 const operations=read("app/api/admin/assist-fulfillment/route.js");
 assert.match(driver,/state==="rejected"\?"funded_awaiting_shopper"/);
 assert.match(driver,/j.state!=="accepted"/);
 assert.match(driver,/driverDispatchEnabled!==true/);
 assert.match(operations,/prior.data\(\).state!=="rejected"/);
 assert.match(operations,/if\(prior.exists\)tx.set\(jobRef,jobData\)/);
 const ui=read("components/driver-assist-shopping.js");
 assert.ok(ui.includes("Accept assignment"));
 assert.ok(ui.includes("Ask customer to approve replacement"));
 assert.ok(ui.includes("Submit receipt for review"));
});
test("private receipt review validates identity, storage path and actual file signatures",()=>{
 const receipt=read("app/api/driver/assist-shopping/receipt/route.js");
 const review=read("app/api/admin/assist-fulfillment/receipt/route.js");
 assert.match(receipt,/validReceiptSignature\(bytes,file.type\)/);
 assert.match(review,/authenticateRequest\(request,\{roles\}\)/);
 assert.match(review,/path!==job.data\(\).receiptPath/);
 assert.match(review,/no-store/);
 assert.match(review,/nosniff/);
});
