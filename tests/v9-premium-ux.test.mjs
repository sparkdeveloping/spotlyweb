import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { saveRideGuestDraft, consumeRideGuestDraft, RIDE_GUEST_DRAFT_TTL_MS } from "../lib/ride-guest-draft.js";
import { approvedTheMenuPhoto, partnerMenuFreshness } from "../lib/themenu-source-policy.js";
import { marketplaceMedia } from "../lib/marketplace-editorial.js";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const pickup = { lat: -17.83173, lng: 31.04542, country: "ZW", city: "Harare", formattedAddress: "Harare, Zimbabwe" };
const dropoff = { lat: -17.82963, lng: 31.04470, country: "ZW", city: "Harare", formattedAddress: "Harare East, Zimbabwe" };
function storage() { const m=new Map();return { getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k) }; }

test("Guest Ride preserves two selected points only temporarily, never account or payment details", () => {
  const db=storage();
  assert.equal(saveRideGuestDraft(db,{pickup,dropoff,serviceType:"economy",email:"should-not-persist@example.com"},1000),true);
  const draft=consumeRideGuestDraft(db,1200);
  assert.equal(draft.pickup.lat,pickup.lat);
  assert.equal(draft.dropoff.lng,dropoff.lng);
  assert.equal(draft.serviceType,"economy");
  assert.equal(draft.email,undefined);
  assert.equal(consumeRideGuestDraft(db,1200),null);
  saveRideGuestDraft(db,{pickup,dropoff,serviceType:"comfort"},1000);
  assert.equal(consumeRideGuestDraft(db,1000+RIDE_GUEST_DRAFT_TTL_MS+1),null);
  assert.equal(saveRideGuestDraft(db,{pickup:{...pickup,lat:200},dropoff},1000),false);
});

test("Ride steps and optional-auth quote work for guests, but real request still requires Firebase", async () => {
  const ui=await read("components/ride-app.js");
  const quote=await read("app/api/customer/rides/quote/route.js");
  const booking=await read("app/api/customer/rides/route.js");
  assert.doesNotMatch(ui, /<AuthGate portal="customer" title="Sign in to request a ride"/);
  assert.match(ui, /publicApiFetch/);
  assert.match(ui, /continueToAccount\("signin"\)/);
  assert.match(ui, /continueToAccount\("signup"\)/);
  assert.match(ui, /consumeRideGuestDraft/);
  assert.match(ui, /setBookingStep\(2\); setPreviewOpen\(true\)/);
  assert.match(ui, /quote\.bookingAvailable===true/);
  assert.match(quote, /authenticateRequest\(request, \{ optional: true \}\)/);
  assert.match(booking, /authenticateRequest\(request\)/);
});

test("Ride Lab tester account picker is role restricted and limited to verified Firebase emails", async () => {
  const api=await read("app/api/admin/ride-lab/testers/route.js");
  const admin=await read("components/admin-mobility-launch.js");
  const invitations=await read("app/api/admin/ride-lab/route.js");
  assert.match(api,/authenticateRequest\(request, \{ roles: ROLES \}\)/);
  assert.match(api,/enforceRateLimit\(request/);
  assert.match(api,/auth\.listUsers\(500\)/);
  assert.match(api,/verified: item\.emailVerified === true/);
  assert.doesNotMatch(api,/phoneNumber|customPermissions/);
  assert.match(admin, /Invite Spotly accounts/);
  assert.match(admin, /Find account/);
  assert.match(admin, /disabled=\{!account\.verified/);
  assert.match(admin, /Save Ride Lab invitations/);
  assert.match(invitations, /testerEmails/);
});

test("Marketplace curation is count-based and sync is bounded into recoverable requests", async () => {
  const route=await read("app/api/admin/curation/route.js");
  const ui=await read("components/admin-marketplace-curation.js");
  assert.match(route,/const CHUNK=75/);
  assert.match(route,/offset:z\.number\(\)\.int\(\)/);
  assert.match(route,/rows\.slice\(offset,offset\+CHUNK\)/);
  assert.match(route,/\.count\(\)\.get\(\)/);
  assert.match(route,/next=\{action,phase:"products",offset:0\}/);
  assert.match(ui,/while\(cursor&&!cancelSyncRef\.current\)/);
  assert.match(ui,/Stop after current batch/);
  assert.match(ui,/Sync paused safely between batches/);
});

test("Licensed independent-menu photos have explicit provenance, branch attestation and freshness", async () => {
  const photo={
    source:{type:"themenu_partner",rightsStatus:"licensed"},
    partnerMedia:{sourceName:"The Menu",usageApproved:true,locationMatched:true,
      sourceUrl:"https://themenu.co.zw/restaurant/123",
      storedUrl:"https://firebasestorage.googleapis.com/v0/b/spotly-africa.appspot.com/o/menu.jpg"}
  };
  assert.equal(approvedTheMenuPhoto(photo)?.kind,"licensed-directory");
  assert.equal(marketplaceMedia(photo).kind,"licensed-directory");
  assert.equal(approvedTheMenuPhoto({...photo, partnerMedia:{...photo.partnerMedia,usageApproved:false}}),null);
  assert.equal(approvedTheMenuPhoto({...photo, partnerMedia:{...photo.partnerMedia,sourceUrl:"https://fake-themenu.co.zw/"}}),null);
  assert.equal(approvedTheMenuPhoto({...photo, partnerMedia:{...photo.partnerMedia,storedUrl:"https://unknown.example/photo.jpg"}}),null);
  const now=Date.parse("2026-10-21T18:00:00Z");
  assert.equal(partnerMenuFreshness({menu:{lastCheckedAt:"2026-10-21T00:00:00Z"}},now).state,"recent");
  assert.equal(partnerMenuFreshness({menu:{lastCheckedAt:"2026-09-01T00:00:00Z"}},now).state,"stale");
  assert.equal(partnerMenuFreshness({},now).state,"unverified");
});

test("Premium discovery differentiates independent Assist from photo-less stale directory cards", async () => {
  const experience=await read("components/service-experience.js");
  const home=await read("components/admin-app.js");
  assert.match(experience,/assistBusinesses/);
  assert.match(experience,/Choose a restaurant, request a price check/);
  assert.match(experience,/Independent directory · not yet orderable/);
  assert.match(experience,/Photo: The Menu/);
  assert.match(home,/items-center gap-4 px-5 py-3/);
});
