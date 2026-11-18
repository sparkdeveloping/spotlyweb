import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateLX13Operations} from '../scripts/lx13-operations-gate.mjs';
const now=Date.parse('2026-11-15T12:00:00Z');
const digest='sha256:'+'a'.repeat(64);
const readyLX12={decision:'NO_GO',assessment:'READY_FOR_MANUAL_REVIEW',candidateDigest:digest};
const critical={duplicateCharges:0,ledgerMismatches:0,unauthorizedActions:0,unsafeDriverAssignments:0,preciseLocationLeaks:0,missedLocationCleanup:0,falseCompletions:0,unavailableSafetySupport:0};
const valid=()=>({
 candidate:{buildDigest:digest,environment:'staging',frozenAt:'2026-11-15T06:00:00Z'},
 window:{startedAt:'2026-11-15T07:00:00Z',endedAt:'2026-11-15T11:00:00Z'},
 scope:{country:'ZW',city:'Harare',service:'ride'},
 operator:'operator01',reviewer:'reviewer02',
 metrics:{attempted:100,completed:98,failed:2,critical:{...critical}},
 billing:{source:'billing_export',sameWindowVerified:true,sameScopeVerified:true,totalCost:9.80,currency:'USD'},
 thresholds:{approved:true,approvedBy:'finance03',maxFailureRate:0.03,maxCostPerCompleted:0.20}
});
const check=(report,lx12=readyLX12)=>evaluateLX13Operations(report,{now,lx12});
test('fully provided test numbers still never grant GO',()=>{
 const output=check(valid());assert.equal(output.assessment,'REQUIRES_HUMAN_REVIEW');assert.equal(output.decision,'NO_GO');
 assert.equal(output.observed.costPerCompleted,0.1);
});
test('missing independent LX12 release evidence blocks the operational review',()=>{
 const result=check(valid(),null);assert.equal(result.assessment,'BLOCKED');assert.ok(result.blockers.some(x=>x.includes('LX12')));
});
test('candidate mismatches are blocked rather than mixed across builds',()=>{
 const r=valid();r.candidate.buildDigest='sha256:'+'b'.repeat(64);
 assert.equal(check(r).assessment,'BLOCKED');
});
test('critical financial safety events trigger stop signals',()=>{
 const r=valid();r.metrics.critical.duplicateCharges=1;
 const result=check(r);assert.equal(result.assessment,'BLOCKED');assert.ok(result.stopSignals.some(x=>x.includes('duplicateCharges')));
});
test('critical driver safety events trigger stop signals',()=>{
 const r=valid();r.metrics.critical.unsafeDriverAssignments=1;
 assert.ok(check(r).stopSignals.some(x=>x.includes('unsafeDriverAssignments')));
});
test('missing counters are blocked rather than assumed zero',()=>{
 const r=valid();delete r.metrics.critical.missedLocationCleanup;
 assert.ok(check(r).blockers.some(x=>x.includes('missedLocationCleanup')));
});
test('inconsistent transaction denominators are blocked',()=>{
 const r=valid();r.metrics.attempted=99;r.metrics.completed=98;r.metrics.failed=2;
 assert.ok(check(r).blockers.some(x=>x.includes('consistent')));
});
test('approved failure-rate threshold can trigger a stop condition',()=>{
 const r=valid();r.metrics.failed=6;r.metrics.completed=94;
 assert.ok(check(r).stopSignals.some(x=>x.includes('Failure rate')));
});
test('approved unit-cost threshold can trigger a stop condition',()=>{
 const r=valid();r.billing.totalCost=100;
 assert.ok(check(r).stopSignals.some(x=>x.includes('Cost per completed')));
});
test('a billing export without same service and country attribution cannot produce a per-transaction rate',()=>{
 const r=valid();r.billing.sameScopeVerified=false;
 const result=check(r); assert.equal(result.observed.costPerCompleted,null); assert.ok(result.reviews.some(x=>x.includes('billing')));
});
test('missing cost proof does not invent cost per completed transaction',()=>{
 const r=valid();r.billing.sameWindowVerified=false;
 const result=check(r); assert.equal(result.observed.costPerCompleted,null);assert.ok(result.reviews.some(x=>x.includes('billing')));
});
test('zero transactions make unit economics explicitly unavailable',()=>{
 const r=valid();r.metrics.attempted=0;r.metrics.completed=0;r.metrics.failed=0;
 const result=check(r); assert.equal(result.observed.costPerCompleted,null);assert.ok(result.reviews.some(x=>x.includes('No attempted')));
});
test('no arbitrary default financial thresholds exist',()=>{
 const r=valid();delete r.thresholds;
 const result=check(r);assert.equal(result.assessment,'REQUIRES_HUMAN_REVIEW');assert.ok(result.reviews.some(x=>x.includes('threshold')));
});
test('old or future observation windows are blocked',()=>{
 const r=valid();r.window.endedAt='2026-12-01T00:00:00Z';assert.equal(check(r).assessment,'BLOCKED');
});
test('scope must reference real contract country and service',()=>{
 const r=valid();r.scope.city='Atlantis';assert.equal(check(r).assessment,'BLOCKED');
});
test('operational gate has no deployments, payments or mutations',()=>{
 const src=readFileSync(new URL('../scripts/lx13-operations-gate.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/firebase-admin|fetch\(|deploy --prod|firebase deploy|setServiceAvailability|createRefund\(/);
 assert.match(src,/decision: "NO_GO"/);
});
