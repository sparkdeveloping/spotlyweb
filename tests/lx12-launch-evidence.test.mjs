import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateLX12Release, LX12_CONFIG, requiredIds } from '../scripts/lx12-launch-gate.mjs';

const now = Date.parse('2026-11-15T12:00:00Z');
const digest='sha256:'+'a'.repeat(64);
const scopes=[
  {country:'ZW',city:'Harare',services:{eat:'live',shop:'disabled',ride:'live',send:'live',book:'live',events:'disabled'}},
  {country:'MW',city:'Lilongwe',services:{eat:'disabled',shop:'disabled',ride:'disabled',send:'disabled',book:'disabled',events:'disabled'}}
];
const shell=()=>({candidate:{buildDigest:digest,sourceRef:'commit_abcdef',frozenAt:new Date(now-3600_000).toISOString(),environment:'staging'},scopes:structuredClone(scopes),evidence:[]});
function fixture(){
  const directory=mkdtempSync(join(tmpdir(),'spotly-lx12-'));
  const report=shell();
  mkdirSync(join(directory,'proofs'));
  for(const [idx,id] of requiredIds(report.scopes).entries()){
    const path=`proofs/${idx}.txt`;
    const body=`staging proof record ${id}\n`;writeFileSync(join(directory,path),body);
    report.evidence.push({id,status:'passed',environment:'staging',buildDigest:digest,
      operator:'tester_001',reviewer:'reviewer_002',testedAt:new Date(now-1200_000).toISOString(),
      artifact:{path,sha256:'sha256:'+createHash('sha256').update(body).digest('hex')}});
  }
  return {report,directory,cleanup:()=>rmSync(directory,{recursive:true,force:true})};
}
const check=(report,directory)=>evaluateLX12Release(report,{directory,now});
test('Missing candidate evidence defaults to NO_GO and cannot claim success',()=>{
  const r=check(null,'.');assert.equal(r.decision,'NO_GO');assert.equal(r.assessment,'BLOCKED');
  assert.ok(r.blockers.some(x=>x.id==='country.ZW'));
});
test('Launch registry covers every canonical service and both supported countries',()=>{
  assert.deepEqual(LX12_CONFIG.services,['eat','shop','ride','send','book','events']);
  assert.deepEqual(LX12_CONFIG.countryCodes,['ZW','MW']);
});
test('Per-service tests are required only for explicitly enabled country-city scopes',()=>{
  const ids=requiredIds(scopes);
  assert.ok(ids.includes('service.ZW.Harare.ride.offer_accept_one_driver'));
  assert.ok(ids.includes('service.MW.Lilongwe.ride.server_nontransactable'));
  assert.ok(!ids.includes('service.MW.Lilongwe.ride.offer_accept_one_driver'));
});
test('Even fully indexed evidence never returns an automatic production GO',()=>{
  const f=fixture();try{const r=check(f.report,f.directory);assert.equal(r.assessment,'READY_FOR_MANUAL_REVIEW');assert.equal(r.decision,'NO_GO');assert.equal(r.blockers.length,0);}finally{f.cleanup()}
});
test('An individual missing proof blocks release review',()=>{
  const f=fixture();try{f.report.evidence.pop();const r=check(f.report,f.directory);assert.equal(r.assessment,'BLOCKED');assert.equal(r.verifiedEvidence,r.requiredEvidence-1);}finally{f.cleanup()}
});
test('Failed proof cannot be replaced by free-text success',()=>{
  const f=fixture();try{f.report.evidence[0].status='passed manually';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');}finally{f.cleanup()}
});
test('Stale tests, mismatched release digests and non-staging results are blocked',()=>{
  const f=fixture();try{
    f.report.evidence[0].testedAt=new Date(now-8*86_400_000).toISOString();assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
    f.report.evidence[0].testedAt=new Date(now-1200_000).toISOString();f.report.evidence[0].buildDigest='sha256:'+'b'.repeat(64);assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
    f.report.evidence[0].buildDigest=digest;f.report.evidence[0].environment='production';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
  }finally{f.cleanup()}
});
test('Unreviewed self-approval cannot substitute for independent review',()=>{
  const f=fixture();try{f.report.evidence[0].reviewer='tester_001';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');}finally{f.cleanup()}
});
test('A modified proof fails its SHA-256 integrity check',()=>{
  const f=fixture();try{writeFileSync(join(f.directory,f.report.evidence[0].artifact.path),'altered');assert.equal(check(f.report,f.directory).assessment,'BLOCKED');}finally{f.cleanup()}
});
test('Path traversal and absolute artifact paths cannot be used as evidence',()=>{
  const f=fixture();try{
    f.report.evidence[0].artifact.path='../outside.txt';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
    f.report.evidence[0].artifact.path='/tmp/outside.txt';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
  }finally{f.cleanup()}
});
test('Symlinked evidence cannot escape the trusted folder',()=>{
  const f=fixture();try{
    symlinkSync('/etc/hosts',join(f.directory,'proofs','symlink'));
    f.report.evidence[0].artifact.path='proofs/symlink';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
  }finally{f.cleanup()}
});
test('Duplicate, unknown and invalid city service scopes fail validation',()=>{
  const f=fixture();try{
    f.report.scopes.push(structuredClone(scopes[0]));assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
    f.report.scopes.pop();f.report.scopes[0].city='Narnia';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
    f.report.scopes[0].city='Harare';f.report.scopes[0].services.ride='maybe';assert.equal(check(f.report,f.directory).assessment,'BLOCKED');
  }finally{f.cleanup()}
});
test('Missing Malawi decision blocks readiness even if Zimbabwe evidence is complete',()=>{
  const f=fixture();try{f.report.scopes=f.report.scopes.slice(0,1);const r=check(f.report,f.directory);assert.ok(r.blockers.some(x=>x.id==='country.MW'));}finally{f.cleanup()}
});
test('An enabled service cannot substitute disabled-state proofs',()=>{
  const f=fixture();try{f.report.scopes[1].services.ride='live';const r=check(f.report,f.directory);assert.ok(r.blockers.some(x=>x.id==='service.MW.Lilongwe.ride.offer_accept_one_driver'));}finally{f.cleanup()}
});
test('Duplicate evidence IDs are rejected even if the files hash correctly',()=>{
  const f=fixture();try{f.report.evidence.push({...f.report.evidence[0]});assert.equal(check(f.report,f.directory).assessment,'BLOCKED');}finally{f.cleanup()}
});
