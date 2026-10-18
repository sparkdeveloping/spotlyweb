import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CLAIM_TRANSFER_KEY, CLAIM_TRANSFER_MAX_AGE, preserveGuestClaim, restoreGuestClaim, forgetGuestClaim, isClaimableExistingBranch } from "../lib/claim-onboarding-continuity.js";

function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}
const example = () => ({ id: "claim_resume", stepIndex: 7, mode: "new", selected: null, selectedBranchIds: [], form: { name: "First Spotly Business", email: "owner@example.test" }, evidence: [{ id: "local_file", staged: true }] });

test("guest claim persists through account-creation redirect and retains progress", () => {
  const s = storage();
  assert.equal(preserveGuestClaim(s, example()), true);
  const recovered = restoreGuestClaim(s);
  assert.equal(recovered.id, "claim_resume");
  assert.equal(recovered.stepIndex, 7);
  assert.equal(recovered.form.name, "First Spotly Business");
  assert.equal(recovered.evidence[0].staged, true);
});

test("expired, malformed and erased transfer states cannot be silently restored", () => {
  const s = storage();
  s.setItem(CLAIM_TRANSFER_KEY, "not json");
  assert.equal(restoreGuestClaim(s), null);
  s.setItem(CLAIM_TRANSFER_KEY, JSON.stringify({ ...example(), savedAt: new Date(1).toISOString() }));
  assert.equal(restoreGuestClaim(s, CLAIM_TRANSFER_MAX_AGE + 60_000), null);
  preserveGuestClaim(s, example());
  forgetGuestClaim(s);
  assert.equal(restoreGuestClaim(s), null);
});

test("directory-only synthetic location cannot be submitted as a Firestore branch", () => {
  assert.equal(isClaimableExistingBranch({ id: "osm_place-place", curated: true }), false);
  assert.equal(isClaimableExistingBranch({ id: "business_location_1", public: true }), true);
  assert.equal(isClaimableExistingBranch({ id: "" }), false);
});

test("public claim wizard has explicit creation, device evidence staging, and account hand-off", () => {
  const jsx = fs.readFileSync("components/claim-app.js", "utf8");
  assert.match(jsx, /No business found with that name/);
  assert.match(jsx, /Add “\{normalized\}” as a new business/);
  assert.match(jsx, /stageClaimFile\(draftId, file\)/);
  assert.match(jsx, /stagedClaimFiles\(draftId\)/);
  assert.match(jsx, /preserveGuestClaim\(window.localStorage/);
  assert.match(jsx, /Secure account & keep my application/);
  assert.match(jsx, /await persistDraft\(\)/);
  assert.match(jsx, /getPublicBranchesForBusiness\(selected.id\)/);
});

test("business claims list offers authenticated draft resumption", () => {
  const jsx = fs.readFileSync("components/business/business-account.js", "utf8");
  assert.match(jsx, /subscribeClaimDrafts\(user.uid/);
  assert.match(jsx, /get-started\?draft=/);
  assert.match(jsx, /Resume application/);
});

test("server refuses forged curated rights, missing evidence, and unauthorized early access", () => {
  const src = fs.readFileSync("app/api/business-claims/submit/route.js", "utf8");
  assert.match(src, /openPlaceById\(input.businessId\)/);
  assert.match(src, /storage.bucket\(\)/);
  assert.match(src, /file.path.startsWith\(`claim-evidence\/\$\{actor.uid\}\//);
  assert.match(src, /\.min\(1\)\.max\(20\)/);
  assert.match(src, /status: "pending_verification"/);
  assert.match(src, /ownerIds: \[\]/);
});

test("claim evidence storage rules match user-facing PDF, image and Word upload support", () => {
  const src = fs.readFileSync("storage.rules", "utf8");
  const block = src.slice(src.indexOf("match /claim-evidence/"), src.indexOf("match /staff/"));
  assert.match(block, /application\/msword/);
  assert.match(block, /wordprocessingml.document/);
  assert.match(block, /10 \* 1024 \* 1024/);
  assert.match(block, /allow delete/);
});
