import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { safeDiagnosticReference, safeDiagnosticCode, safeDiagnosticClass } from "../lib/diagnostic-reference.mjs";
import { waveDLegalFinanceReview } from "../lib/wave-d-legal-finance-policy.mjs";
import { requiredIds } from "../scripts/lx12-launch-gate.mjs";
import { WAVE_D_GATES, evaluateWaveDRelease } from "../scripts/wave-d-release-gate.mjs";
import { evaluateStrictNodeRun } from "../scripts/wave-d-strict-test-audit.mjs";
import { routeHarness } from "./helpers/route-harness.mjs";

const root = resolve(import.meta.dirname, "..");
const source = file => readFileSync(resolve(root, file), "utf8");

test("U12: diagnostic references and codes accept only bounded metadata", () => {
  assert.equal(safeDiagnosticReference("SR-0123456789AB"), "SR-0123456789AB");
  for (const entry of ["SI-0123456789AB", "sr-0123456789ab", "SR-0123456789AB?token=x", "secret@example.com", "SR-0123456789AB\n"]) assert.equal(safeDiagnosticReference(entry), null);
  assert.equal(safeDiagnosticCode("network_unavailable"), "network_unavailable");
  for (const entry of ["secret@mail.com", "token=abc", "A very private stack", "x".repeat(50)]) assert.equal(safeDiagnosticCode(entry), "internal");
  assert.equal(safeDiagnosticClass("FirebaseError"), "FirebaseError");
  assert.equal(safeDiagnosticClass("SecretError"), "Other");
});

test("U12: API failures create log-correlatable references but redact stacks/messages", () => {
  const h = routeHarness(root, {
    "firebase-admin/app": {applicationDefault:()=>({}),cert:()=>({}),getApps:()=>[],initializeApp:()=>({})},
    "firebase-admin/auth": {getAuth:()=>({})},
    "firebase-admin/app-check": {getAppCheck:()=>({})},
    "firebase-admin/firestore": {getFirestore:()=>({}),FieldValue:{serverTimestamp:()=>null},Timestamp:{fromMillis:()=>null}},
    "firebase-admin/database": {getDatabase:()=>({})},
    "firebase-admin/messaging": {getMessaging:()=>({})},
    "firebase-admin/storage": {getStorage:()=>({})},
  });
  const { apiError } = h.load("lib/firebase-admin.js");
  const original = console.error, logs=[];
  console.error = value => logs.push(value);
  let response;
  try {
    const err = Object.assign(new Error("PRIVATE customer@example.com /checkout?auth=token"), {code:"internal_failure",stack:"PRIVATE sensitive stack"});
    response = apiError(err);
  } finally { console.error = original; }
  assert.equal(response.status, 500);
  const ref = response.headers.get("X-Spotly-Reference");
  assert.match(ref, /^SR-[A-F0-9]{12}$/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0]).reference, ref);
  for (const privateText of ["customer@example.com", "/checkout", "PRIVATE", "token", "sensitive stack"]) {
    assert.ok(!logs[0].includes(privateText), privateText);
  }
  return response.json().then(payload => { assert.equal(payload.reference, ref); assert.ok(!JSON.stringify(payload).includes("customer@example.com")); });
});

test("U12: clients display only server-minted references, native Crashlytics uses safe synthetic errors", () => {
  assert.match(source("lib/api-client.js"), /safeDiagnosticReference/);
  assert.match(source("components/providers.js"), /Support reference/);
  for (const file of [
    "../../customer/spotly/spotly/Core/Platform/SpotlyObservability.swift",
    "../../driver/spotlydriver/spotlydriver/Core/Platform/DriverObservability.swift"
  ]) {
    const native = source(file);
    assert.match(native, /let diagnostic = NSError/);
    assert.match(native, /Crashlytics\.crashlytics\(\)\.record\(error: diagnostic/);
    assert.doesNotMatch(native, /\.record\(error: error/);
    assert.doesNotMatch(native, /localizedDescription, forKey:/);
  }
  const callable = source("../../business/spotlybusiness/spotlybusiness/Production/FirebaseFunctionsService.swift");
  assert.doesNotMatch(callable, /AppError\.(?:authorization|validation|conflict|server)\(failure\.localizedDescription\)/);
});

const approved = () => ({status:"approved", reviewedBy:"reviewer-legal", evidenceRef:"attested-record", reviewedAt:"2026-11-17T12:00:00.000Z"});
const compliance = () => {
  const scopes = {};
  for (const country of ["ZW","MW"]) {
    scopes[country]={};
    for (const service of ["ride","send","business"]) {
      const requirements = ["privacyReview", "legalEntity", "supportResponse", "financialSettlement", ...(
        service === "ride" ? ["transportAuthorityReview", "driverVehicleVerification", "safetyResponse"] :
        service === "send" ? ["deliveryAuthorityReview", "driverVehicleVerification"] :
        ["merchantAgreement", "merchantVerification"]
      )];
      scopes[country][service]=Object.fromEntries(requirements.map(key => [key, approved()]));
    }
  }
  return scopes;
};

const policy = () => ({
  legal:{privacyPolicyUrl:"https://spotlyafrica.com/privacy", termsUrl:"https://spotlyafrica.com/terms",refundPolicyUrl:"https://spotlyafrica.com/refunds"},
  launchCompliance:compliance(),
  commercialPlans:{mode:"active", revision:4, agreementVersion:"merchant-2026-11", agreementUrl:"https://spotlyafrica.com/merchant-terms",rules:[{country:"ZW",service:"eat",businessType:"*",commissionPercent:4}],
    trial:{status:"hidden"}}
});

test("U13: legal/finance dashboard never certifies actual ledger or legal authority from settings", () => {
  const state = waveDLegalFinanceReview(policy(), Date.parse("2026-11-18T12:00:00Z"));
  assert.equal(state.productionDecision, "NO_GO");
  assert.equal(state.scoped.length, 6);
  assert.ok(state.scoped.every(item => item.ready));
  assert.equal(state.checks.find(item=>item.id==="wave-d-finance-reconciliation").state, "needs_verification");
  assert.equal(state.checks.find(item=>item.id==="wave-d-country-approvals").state, "needs_verification");
  assert.equal(state.checks.find(item=>item.id==="wave-d-finance-pricing").state, "needs_verification");
  assert.match(source("app/api/admin/launch-readiness/route.js"), /waveDLegalFinanceReview\(settings\)/);
});

test("U13: missing Malawi evidence, unapproved live trial and invalid rates block review", () => {
  const settings = policy();
  delete settings.launchCompliance.MW;
  settings.commercialPlans.rules[0].commissionPercent = -1;
  settings.commercialPlans.trial.status="live";
  const result = waveDLegalFinanceReview(settings, Date.parse("2026-11-18T12:00:00Z"));
  assert.equal(result.checks.find(item=>item.id==="wave-d-finance-pricing").state, "blocked");
  assert.equal(result.checks.find(item=>item.id==="wave-d-trial").state, "blocked");
  assert.equal(result.checks.find(item=>item.id==="wave-d-country-approvals").state, "blocked");
  assert.ok(result.scoped.filter(item=>item.country==="ZW").every(item=>item.ready));
  assert.ok(result.scoped.filter(item=>item.country==="MW").every(item=>!item.ready));
});

const disabled = {eat:"disabled",shop:"disabled",ride:"disabled",send:"disabled",book:"disabled",events:"disabled"};
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),"spotly-wave-d-test-"));
  const file=join(directory,"review.md");
  writeFileSync(file,"Synthetic test record; NOT a release approval.\n");
  const digest="sha256:"+createHash("sha256").update(readFileSync(file)).digest("hex");
  const now=Date.parse("2026-11-18T12:00:00Z");
  const candidate={buildDigest:"sha256:"+"a".repeat(64),sourceRef:"test_merge_123",environment:"staging",frozenAt:new Date(now-120000).toISOString()};
  const scopes=[{country:"ZW",city:"Harare",services:{...disabled}},{country:"MW",city:"Lilongwe",services:{...disabled}}];
  const record = id => ({id,status:"passed",operator:"test_operator",reviewer:"independent_reviewer",environment:"staging",
    buildDigest:candidate.buildDigest,testedAt:new Date(now-50000).toISOString(),artifact:{path:"review.md",sha256:digest}});
  const report={candidate,scopes,evidence:requiredIds(scopes).map(record),waveDEvidence:WAVE_D_GATES.map(record)};
  return {directory,report,now, cleanup:()=>rmSync(directory,{force:true,recursive:true})};
}

test("U14: even a metadata-complete synthetic manifest never authorizes production",()=>{
  const f=fixture();try {
    const result=evaluateWaveDRelease(f.report,{directory:f.directory,now:f.now});
    assert.equal(result.assessment,"READY_FOR_MANUAL_REVIEW");
    assert.equal(result.releaseDecision,"NO_GO");
    assert.equal(result.blockers.length,0);
    assert.ok(result.requiredEvidence > 27);
  } finally {f.cleanup();}
});

test("U14: missing, stale, mismatched or duplicate evidence is fail-closed",()=>{
  const f=fixture();try {
    const prior=evaluateWaveDRelease(f.report,{directory:f.directory,now:f.now});
    assert.equal(prior.blockers.length,0);
    const missing={...f.report,waveDEvidence:f.report.waveDEvidence.slice(1)};
    assert.ok(evaluateWaveDRelease(missing,{directory:f.directory,now:f.now}).blockers.some(b=>b.id===WAVE_D_GATES[0]));
    const duplicate={...f.report,waveDEvidence:[...f.report.waveDEvidence, f.report.waveDEvidence[0]]};
    assert.match(JSON.stringify(evaluateWaveDRelease(duplicate,{directory:f.directory,now:f.now}).blockers),/Duplicate evidence/);
    const wrongPath={...f.report,waveDEvidence:f.report.waveDEvidence.map((r,i)=>i? r : {...r,artifact:{...r.artifact,path:"../review.md"}})};
    assert.match(JSON.stringify(evaluateWaveDRelease(wrongPath,{directory:f.directory,now:f.now}).blockers),/checksum\/path is invalid/);
    const stale={...f.report,waveDEvidence:f.report.waveDEvidence.map((r,i)=>i? r : {...r,testedAt:new Date(f.now-9*86400000).toISOString()})};
    assert.equal(evaluateWaveDRelease(stale,{directory:f.directory,now:f.now}).assessment,"BLOCKED");
    const mismatched={...f.report,waveDEvidence:f.report.waveDEvidence.map((r,i)=>i? r : {...r,buildDigest:"sha256:"+"f".repeat(64)})};
    assert.equal(evaluateWaveDRelease(mismatched,{directory:f.directory,now:f.now}).assessment,"BLOCKED");
  } finally {f.cleanup();}
});

test("U14: one-country release evidence cannot authorize the other country",()=>{
  const f=fixture();try {
    const missingScope={...f.report,scopes:f.report.scopes.filter(s=>s.country==="ZW")};
    const result=evaluateWaveDRelease(missingScope,{directory:f.directory,now:f.now});
    assert.equal(result.assessment,"BLOCKED");
    assert.ok(result.blockers.some(b=>b.id==="lx12.country.MW"));
  } finally {f.cleanup();}
});

test("U14: zero-skips release rule rejects known Wave C skips and incomplete TAP",()=>{
  const blocked=evaluateStrictNodeRun("# tests 1023\n# pass 1021\n# fail 0\n# skipped 2\n# todo 0\n");
  assert.equal(blocked.status,"BLOCKED");
  assert.equal(blocked.skipped,2);
  assert.equal(evaluateStrictNodeRun("# tests 1021\n# pass 1021\n# fail 0\n# skipped 0\n# todo 0\n").status,"SOURCE_SUITE_PASSED_ONLY");
  assert.equal(evaluateStrictNodeRun("# tests 1\n# pass 1\n").status,"BLOCKED");
});
