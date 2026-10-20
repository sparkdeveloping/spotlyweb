import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shoppingActivity,bookingActivity} from "../lib/assist-activity.js";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("independent quote is unpaid and expires without merchant checkout",()=>{
 const q={storeId:"branch",state:"quote_offered",finalQuote:{currency:"USD",total:12,expiresAt:"2026-10-20T11:00:00Z"}};
 const t=Date.parse("2026-10-20T10:00:00Z");
 assert.equal(shoppingActivity("req",q,t).primaryAction,"review_quote");
 assert.equal(shoppingActivity("req",q,t+7200000).primaryAction,null);
 assert.equal(shoppingActivity("req",q,t).paymentEnabled,false);
});
test("assisted booking alternative remains uncharged",()=>{
 const a=bookingActivity("req",{state:"alternative_offered",businessId:"branch"});
 assert.equal(a.primaryAction,"review_alternative");assert.equal(a.paymentEnabled,false);
});
test("Activity includes customer-scoped Assist documents",()=>{
 const api=read("app/api/customer/activity/route.js");
 assert.match(api,/shoppingActivity\(/);assert.match(api,/bookingActivity\(/);
 assert.match(api,/independentShoppingRequests/);assert.match(api,/assistedBookings/);
});
test("UI offers real quote decisions, never a merchant payment shortcut",()=>{
 assert.match(read("components/marketplace-app.js"),/AssistActivitySection/);
 const ui=read("components/assist-activity-section.js");
 assert.match(ui,/Accept quote \(no payment\)/);
 assert.doesNotMatch(ui,/payments\/paynow/);
});
test("operator evidence and customer expiry plus region checks are mandatory",()=>{
 assert.match(read("app/api/admin/assist-shopping/actions/route.js"),/body.note.trim\(\).length<12/);
 const r=read("app/api/customer/independent-shopping/requests/respond/route.js");
 assert.match(r,/independentShoppingFlags\(settings\).requestEnabled/);
 assert.match(r,/regionalServicePolicy\(settings.assistCoverage/);
});
