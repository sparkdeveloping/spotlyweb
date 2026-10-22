import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adminBusinessState, adminBusinessMatches, adminSafeBusiness } from "../lib/admin-business-register.js";
const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("business classification never equates directory publication with merchant approval",()=>{
  const directory={name:"Example",public:true,claimStatus:"unclaimed",verificationStatus:"unverified",status:"provisional"};
  let s=adminBusinessState(directory);
  assert.equal(s.publication,"visible");assert.equal(s.commerce,"not_enabled");
  assert.equal(s.merchantLive,false);assert.equal(s.attention,"unclaimed");
  s=adminBusinessState({...directory,claimStatus:"claim_pending"});
  assert.equal(s.ownership,"claim_pending");assert.equal(s.attention,"ownership");
  s=adminBusinessState({...directory,claimStatus:"claimed",ownerIds:["owner"],verificationStatus:"approved",lifecycleStatus:"live",status:"active"});
  assert.equal(s.merchantLive,true);assert.equal(s.commerce,"merchant_live");
  assert.equal(adminBusinessState({...directory,assistStoreId:"assist_1"}).commerce,"independent_assist");
  assert.equal(adminBusinessState({...directory,verificationStatus:"approved",claimStatus:"claimed",status:"suspended"}).attention,"suspended");
});

test("business register supports date, source, creator, claim, verification and search filters",()=>{
  const item={id:"b1",name:"Restaurant Example",city:"Harare",category:"Food",createdBy:"creator-1",
    ownerIds:[],source:{type:"owner_created"},createdAt:"2026-10-20T12:00:00Z",
    claimStatus:"claim_pending",verificationStatus:"pending",public:false};
  assert.equal(adminBusinessMatches(item,{q:"creator-1",city:"Harare",source:"owner_created",from:"2026-10-20",to:"2026-10-21",attention:"ownership"}),true);
  assert.equal(adminBusinessMatches(item,{from:"2026-10-21"}),false);
  assert.equal(adminBusinessMatches(item,{to:"2026-10-19"}),false);
  assert.equal(adminBusinessMatches(item,{publication:"visible"}),false);
  assert.equal(adminBusinessMatches(item,{verification:"approved"}),false);
  assert.equal(adminBusinessMatches(item,{ownership:"claim_pending"}),true);
  const safe=adminSafeBusiness("b1",item);
  assert.equal(safe.createdBy,"creator-1");assert.equal(safe.id,"b1");
  assert.equal(safe.phone,undefined);assert.equal(safe.bankAccount,undefined);
});

test("server business register is authorized, paginated, never modifies business status, and resolves account relationships",async()=>{
  const route=await read("app/api/admin/business-register/route.js");
  assert.match(route,/authenticateRequest\(request\)/);
  assert.match(route,/requirePlatformPermission\(actor,"businesses.read"/);
  assert.match(route,/enforceRateLimit\(request/);
  assert.match(route,/orderBy\(sort,filters\.direction\)/);
  assert.match(route,/query\.startAfter\(cursor\)/);
  assert.match(route,/page<4/);
  assert.match(route,/auth\.getUserByEmail\(email\.toLowerCase\(\)\)/);
  assert.match(route,/where\("createdBy","==",uid\)/);
  assert.match(route,/where\("ownerIds","array-contains",uid\)/);
  assert.match(route,/where\("applicantId","==",uid\)/);
  assert.match(route,/scannedOnly:true/);
  assert.doesNotMatch(route,/\.update\(|\.set\(|\.delete\(|\.add\(/);
});

test("business register and admin overview explain relationship states and cap warning",async()=>{
  const body=await read("components/admin-business-register.js");
  const admin=await read("components/admin-app.js");
  const guide=await read("components/admin-operations-guide.js");
  const nav=await read("data/portals.js");
  assert.match(body,/Business control centre/);
  assert.match(body,/createdBy/);
  assert.match(body,/Claims submitted by this account/);
  assert.match(body,/Created by is an audit identity, not proof of business ownership/);
  assert.match(body,/Created from \(UTC\)/);
  assert.match(body,/Next page/);
  assert.match(body,/Export visible results/);
  assert.match(admin,/AdminBusinessRegisterBody/);
  assert.match(admin,/Up to 100 loaded/);
  assert.match(guide,/Support resolved/);
  assert.match(guide,/Spotly Assist/);
  assert.match(nav,/label: "Business register"/);
  assert.match(nav,/label: "How Admin works"/);
});

test("support triage has category, date range, urgency and explicit business relationship entry points",async()=>{
  const support=await read("components/admin-support-console.js");
  assert.match(support,/categoryFilter/);
  assert.match(support,/dateFrom/);
  assert.match(support,/dateTo/);
  assert.match(support,/sortOrder === "oldest"/);
  assert.match(support,/potentially waiting over 24h/);
  assert.match(support,/subscription capped at 300/);
  assert.match(support,/Business register/);
  assert.match(support,/updateSupportConversation/);
  assert.match(support,/sendSupportMessage/);
});
