import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { safeTheMenuUrl, theMenuImageReferences, theMenuRestaurantInfo, approvedImageImport } from "../lib/themenu-image-extractor.js";
import catalog from "../data/themenu/image-candidates-2026-10-21.json" with {type:"json"};

const read = file => readFile(new URL(`../${file}`,import.meta.url),"utf8");
const source="https://themenu.co.zw/listings/restaurants/fishmonger.html";
const html=`<html><body><header><img src="/logo.svg" alt="Logo"></header>
<h1>Fishmonger</h1><img src="/assets/photos/fishmonger.jpg" alt="Fishmonger" />
<img data-src="/assets/menus/fishmonger/menu-2.jpg" alt="Fishmonger menu" />
<img src="https://www.google.com/logo.jpg" alt="External" />
<img src="/assets/photos/fishmonger.jpg" alt="Duplicate" />
<p>Photo: <a href="https://www.google.com/">Google Maps</a> · Menu photos via Google Maps</p></body></html>`;

test("extracted catalog includes actual source-page image references with preserved provenance",()=>{
  assert.equal(catalog.schemaVersion,1);
  assert.ok(catalog.listingCandidates.length>=15);
  assert.equal(catalog.detailedPages.length,2);
  const names=catalog.listingCandidates.map(item=>item.name);
  assert.ok(names.includes("Gavas Restaurant"));
  assert.ok(names.includes("Queen of Hearts"));
  assert.ok(catalog.detailedPages.some(item=>item.restaurant==="Fishmonger"));
  assert.ok(catalog.listingCandidates.every(item=>item.rightsStatus==="pending_provenance_review" && !item.imagePublished));
});

test("extractor resolves only safe HTTPS The Menu image assets, preserving exact URLs",()=>{
  const refs=theMenuImageReferences(html,source);
  assert.equal(refs.length,2);
  assert.equal(refs[0].imageUrl,"https://themenu.co.zw/assets/photos/fishmonger.jpg");
  assert.equal(refs[1].kind,"menu");
  assert.equal(refs[1].rightsStatus,"pending_provenance_review");
  assert.equal(refs[0].approvedForSpotly,false);
  assert.equal(safeTheMenuUrl("https://badthemenu.co.zw/photo.jpg"),null);
  assert.equal(safeTheMenuUrl("http://themenu.co.zw/photo.jpg"),null);
  assert.equal(safeTheMenuUrl("https://themenu.co.zw.evil.test/img.png"),null);
  assert.equal(safeTheMenuUrl("//localhost/private"),null);
});

test("parser tags sourced imagery as review-only and keeps source credit",()=>{
  const result=theMenuRestaurantInfo(html,source);
  assert.equal(result.name,"Fishmonger");
  assert.equal(result.imageReferences.length,2);
  assert.equal(result.publishedPhotoCount,0);
  assert.equal(result.imageRightsState,"review_required");
  assert.ok(result.sourcePhotoCredits[0].includes("Google Maps"));
  assert.equal(theMenuRestaurantInfo(html,"https://google.com/fishmonger"),null);
});

test("publishing rejects unchecked photo rights even if a candidate URL exists",()=>{
  const base={imageUrl:"https://themenu.co.zw/assets/photos/fishmonger.jpg",sourcePage:source,
    locationMatchStatus:"verified",rightsEvidence:"Signed photo-specific usage grant"};
  assert.equal(approvedImageImport({...base,rightsStatus:"pending_provenance_review",approvedForSpotly:true}),null);
  assert.equal(approvedImageImport({...base,rightsStatus:"licensed",approvedForSpotly:false}),null);
  assert.equal(approvedImageImport({...base,rightsStatus:"licensed",approvedForSpotly:true,rightsEvidence:""}),null);
  assert.deepEqual(approvedImageImport({...base,rightsStatus:"licensed",approvedForSpotly:true}),{
    imageUrl:base.imageUrl,sourcePage:base.sourcePage,rightsEvidence:base.rightsEvidence
  });
});

test("Admin preview is gated and read-only; extractor produces private artifact, not storefront media",async()=>{
  const route=await read("app/api/admin/themenu-images/route.js");
  const ui=await read("components/admin-themenu-images.js");
  const script=await read("scripts/themenu-image-catalog.mjs");
  assert.match(route,/authenticateRequest\(request, \{ roles \}\)/);
  assert.match(route,/candidates\.some\(item => item\.sourcePage === sourcePage\)/);
  assert.match(route,/enforceRateLimit/);
  assert.doesNotMatch(route,/db\.collection|\.set\(|\.update\(|\.add\(/);
  assert.match(ui,/Rights not cleared/);
  assert.match(ui,/referrerPolicy="no-referrer"/);
  assert.match(ui,/Original restaurant listing/);
  assert.match(script,/artifacts\/themenu-review/);
  assert.doesNotMatch(script,/firebase-admin|put\(|upload\(|db\.collection/);
});
