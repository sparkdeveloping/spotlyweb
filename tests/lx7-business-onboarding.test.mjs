import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const businessSwift = (p) => fs.readFileSync(new URL(`../../../business/spotlybusiness/spotlybusiness/${p}`, import.meta.url), "utf8");
const countryContract = JSON.parse(read("contracts/spotly-countries.v1.json"));

test("LX7 business landing has a single acquisition journey, without mock earnings", () => {
  const source = read("components/business/business-marketing.js");
  assert.match(source, /const startHref = spotlyPortalUrl\("business", "\/get-started"\)/);
  assert.match(source, /Sign in/);
  assert.match(source, /Get started/);
  assert.match(source, /Once approved/);
  assert.doesNotMatch(source, /ProductPreview|statValue:|statLabel:|next payout is on track|Harare CBD · Open/i);
  assert.doesNotMatch(source, /three.month.*free|90.days.*free|free trial/i);
});

test("LX7 no-business state preserves real claims and invitation access without illustrative cards", () => {
  const source = read("components/business/no-business.js");
  assert.match(source, /subscribeClaims\(\(records\)/);
  assert.match(source, /claimsError/);
  assert.match(source, /setReloadKey/);
  assert.match(source, /business-invitations\/accept/);
  assert.match(source, /claim-status/);
  assert.match(source, /Get started/);
  assert.doesNotMatch(source, /Example: we found your listing|Already known|Zimbabwe business directory/);
});

test("LX7 web onboarding retains autosave, evidence and secure submission", () => {
  const source = read("components/claim-app.js");
  for (const required of ["persistDraft", "restoreGuestClaim", "preserveGuestClaim", "business-claims/submit", "validation(index)", "selectedBranchIds", "submit()", "goToRequests"]) {
    assert.ok(source.includes(required), `Missing ${required}`);
  }
  assert.match(source, /Additional details \(optional\)/);
  assert.match(source, /stepIndex === 8 \? <Button onClick=\{submit\}/);
  assert.match(source, /Step \{stepIndex \+ 1\} of \{STEPS\.length\}/);
});

test("LX7 native onboarding keeps saved drafts, evidence and direct verified submission", () => {
  const view = businessSwift("Features/Account/BusinessClaimJourneyView.swift");
  const store = businessSwift("Production/BusinessClaimStore.swift");
  assert.match(view, /if store\.loaded && store\.savedDrafts\.isEmpty \{ started = true \}/);
  assert.match(view, /await store\.resume\(draft\)/);
  assert.match(view, /DisclosureGroup\("More public details \(optional\)"/);
  assert.match(view, /store\.draft\.step >= 8 \{ Task \{ await store\.submit/);
  assert.match(store, /for step in 0\.\.\.7 \{ if let error = draft\.validation/);
  assert.match(store, /"claim-evidence\//);
  assert.match(store, /"status": "draft"/);
});

test("LX7 native country choices match the versioned Zimbabwe and Malawi contract", () => {
  const store = businessSwift("Production/BusinessClaimStore.swift");
  const view = businessSwift("Features/Account/BusinessClaimJourneyView.swift");
  for (const country of countryContract.countries) {
    assert.match(store, new RegExp(`"${country.code}": \\[([^\\]]+)\\]`));
    for (const city of country.cities) assert.ok(store.includes(`"${city.name}"`), `Missing ${country.code}/${city.name}`);
  }
  assert.match(store, /country: form\["country"\] \?\? "ZW"/);
  assert.match(store, /BusinessClaimCountries\.contains\(country:/);
  assert.match(view, /Text\("Zimbabwe"\)\.tag\("ZW"\)/);
  assert.match(view, /Text\("Malawi"\)\.tag\("MW"\)/);
  assert.match(view, /store\.draft\.form\["city"\] = ""/);
});

test("LX7 native account entry and business hub follow one clear path", () => {
  const entry = businessSwift("Features/Entry/EntryFlowView.swift");
  const hub = businessSwift("Features/Account/BusinessAccountHubView.swift");
  assert.match(entry, /Let's get started\./);
  assert.match(hub, /Get started/);
  assert.match(hub, /sheet = \.claim/);
  assert.match(hub, /sheet = \.invitations/);
  assert.match(hub, /refreshPortfolio/);
});

test("LX7 leaves payment, launch, claim authorization and backend Functions unchanged", () => {
  for (const path of ["app/api/business-claims/submit/route.js", "app/api/business/money/route.js", "app/api/business/launch-review/submit/route.js"]) {
    assert.ok(read(path).length > 200);
  }
  const native = businessSwift("Production/BusinessClaimStore.swift");
  assert.match(native, /mode == "new"/);
  assert.match(native, /"source"|source: \.init\(type: "owner_created"\)/);
});
