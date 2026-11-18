import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildBusinessCandidate } from '../scripts/rb2-business-candidate.mjs';
import { evaluateAttestationEvidence } from '../scripts/rb2-app-check-gate.mjs';
const web=resolve(import.meta.dirname,'..');
const business=resolve(web,'../../business/spotlybusiness');
const valid=(now=Date.now())=>({releaseSha256:'a'.repeat(64),environment:'staging',collectedAt:new Date(now-1000).toISOString(),verifierRole:'independent-qa',clients:Object.fromEntries(['web','customerIOS','driverIOS','businessIOS'].map(k=>[k,{validAccepted:1,invalidRejected:1,missingRejected:1,authenticatedFlowSucceeded:1}]))});
test('RB2 evidence never authorizes production even after complete checks',()=>{
 const r=evaluateAttestationEvidence(valid(),{expectedReleaseSha256:'a'.repeat(64)});assert.equal(r.missing.length,0);assert.equal(r.productionDecision,'NO_GO');assert.equal(r.status,'EVIDENCE_PRESENT_REQUIRES_MANUAL_REVIEW');
});
test('RB2 self-reported release hash without trusted expected artifact blocks',()=>{assert.equal(evaluateAttestationEvidence(valid()).status,'BLOCKED')});
test('RB2 conflicting release hash blocks',()=>{assert.ok(evaluateAttestationEvidence(valid(),{expectedReleaseSha256:'b'.repeat(64)}).missing.some(x=>x.includes('does not match')));});
test('RB2 missing App Check evidence blocks',()=>assert.equal(evaluateAttestationEvidence(null).status,'BLOCKED'));
test('RB2 missing valid attestation for Driver blocks',()=>{const r=valid();r.clients.driverIOS.validAccepted=0;assert.ok(evaluateAttestationEvidence(r,{expectedReleaseSha256:'a'.repeat(64)}).missing.some(x=>x.includes('driverIOS')));});
test('RB2 missing invalid token rejection blocks',()=>{const r=valid();r.clients.web.invalidRejected=0;assert.ok(evaluateAttestationEvidence(r,{expectedReleaseSha256:'a'.repeat(64)}).missing.some(x=>x.includes('invalid tokens')));});
test('RB2 stale evidence blocks',()=>{const r=valid();r.collectedAt='2026-01-01T00:00:00Z';assert.equal(evaluateAttestationEvidence(r,{expectedReleaseSha256:'a'.repeat(64)}).status,'BLOCKED');});
test('RB2 self approval blocks',()=>{const r=valid();r.verifierRole='developer';assert.equal(evaluateAttestationEvidence(r,{expectedReleaseSha256:'a'.repeat(64)}).status,'BLOCKED');});
test('RB2 candidate never marks unverified Business backend deployable',()=>{
 const temp=mkdtempSync(join(tmpdir(),'spotly-rb2-candidate-'));try{
  const r=buildBusinessCandidate({webRoot:web,businessRoot:business,outRoot:join(temp,'candidate'),write:true});
  assert.equal(r.deployAllowed,false);assert.equal(r.callableExports,16);assert.equal(r.canonicalDriftCount,18);assert.ok(r.transitiveFiles>=55);assert.deepEqual(r.unresolved,[]);
  assert.ok(existsSync(join(temp,'candidate','canonical','lib','public-read-rate-limit.mjs')));
  assert.ok(readFileSync(join(temp,'candidate','canonical','data','business-archetypes.js'),'utf8').includes('Presentation-only icon identifiers'));
 }finally{rmSync(temp,{recursive:true,force:true});}
});
test('RB2 Business candidate cannot write inside original Business or web source',()=>{
 assert.throws(()=>buildBusinessCandidate({webRoot:web,businessRoot:business,outRoot:join(business,'Backend','functions','canonical')}),/overwrite source projects/);
});
