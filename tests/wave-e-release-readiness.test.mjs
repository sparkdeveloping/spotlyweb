import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WAVE_D_GATES } from '../scripts/wave-d-release-gate.mjs';
import { requiredIds } from '../scripts/lx12-launch-gate.mjs';
import { WAVE_E_REHEARSALS, rehearsalSignatureMessage, evaluateWaveERelease } from '../scripts/wave-e-release-gate.mjs';
import { checkStagingTarget } from '../scripts/wave-e-staging-safety.mjs';
import config from '../contracts/spotly-wave-e-rehearsals.v1.json' with { type: 'json' };

const day = 86_400_000;
const now = Date.parse('2026-11-18T18:00:00Z');
const disabled = {eat:'disabled',shop:'disabled',ride:'disabled',send:'disabled',book:'disabled',events:'disabled'};
function setup() {
  const directory = mkdtempSync(join(tmpdir(), 'spotly-wave-e-test-'));
  mkdirSync(join(directory, 'proofs'));
  const candidate = { buildDigest:'sha256:'+'a'.repeat(64),sourceRef:'test_merge_e',environment:'staging',frozenAt:new Date(now-120_000).toISOString() };
  const scopes = [
    {country:'ZW',city:'Harare',services:{...disabled}},
    {country:'MW',city:'Lilongwe',services:{...disabled}}
  ];
  const textFile = (name) => {
    writeFileSync(join(directory,'proofs',name), `Synthetic-only placeholder ${name}. NOT launch evidence.\n`);
    const sha = 'sha256:'+createHash('sha256').update(readFileSync(join(directory,'proofs',name))).digest('hex');
    return {path:'proofs/'+name,sha256:sha};
  };
  const generic = id => ({id,status:'passed',environment:'staging',buildDigest:candidate.buildDigest,
    testedAt:new Date(now-60_000).toISOString(),operator:'test_operator',reviewer:'test_reviewer',artifact:textFile('d-'+id.replace(/[^a-z0-9_-]/gi,'_')+'.txt')});
  const report = { candidate,scopes,evidence:requiredIds(scopes).map(generic),waveDEvidence:WAVE_D_GATES.map(generic),waveERehearsals:[] };
  const identities = {};
  const keys = [];
  for (const role of ['security','finance','operations','engineering']) {
    const pair = generateKeyPairSync('ed25519');
    identities[role] = pair.privateKey;
    keys.push({keyId:'key_'+role,reviewer:'reviewer_'+role,role,publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'})});
  }
  for (const [index, entry] of config.rehearsals.entries()) {
    const row = {id:entry.id,status:'passed',environment:'staging',buildDigest:candidate.buildDigest,testedAt:new Date(now-30_000).toISOString(),
      operator:'test_operator',reviewer:'reviewer_'+entry.role,keyId:'key_'+entry.role,artifact:textFile('e-'+index+'.txt')};
    row.signature = sign(null,rehearsalSignatureMessage(row),identities[entry.role]).toString('base64');
    report.waveERehearsals.push(row);
  }
  const trustedKeys = { keys };
  const evaluate = (r=report,t=trustedKeys) => evaluateWaveERelease(r,{directory,now,trustedKeys:t});
  const cleanup = () => rmSync(directory,{recursive:true,force:true});
  return { directory,report,trustedKeys,identities,cleanup,evaluate };
}

test('U16: all eight separately signed synthetic receipts are still NOT a GO decision', () => {
  const f=setup();try {
    assert.deepEqual(WAVE_E_REHEARSALS,config.rehearsals.map(x=>x.id));
    const result=f.evaluate();
    assert.equal(result.assessment,'READY_FOR_MANUAL_REVIEW');
    assert.equal(result.productionDecision,'NO_GO');
    assert.equal(result.verifiedRehearsals,8);
    assert.equal(result.blockers.length,0);
  } finally {f.cleanup();}
});

test('U16: no independent trust roots and missing Wave D evidence fail closed',()=>{
  const f=setup();try {
    assert.equal(f.evaluate(f.report,{keys:[]}).assessment,'BLOCKED');
    assert.equal(f.evaluate({...f.report,waveDEvidence:[]}).assessment,'BLOCKED');
    assert.equal(f.evaluate({...f.report,evidence:[]}).assessment,'BLOCKED');
  } finally {f.cleanup();}
});

test('U16: signatures bind every reviewer, build and artifact field',()=>{
  const f=setup();try {
    const first=f.report.waveERehearsals[0];
    for (const change of [{reviewer:'reviewer_fake'},{keyId:'key_security'},{buildDigest:'sha256:'+'f'.repeat(64)},{testedAt:new Date(now-10_000).toISOString()},
      {artifact:{...first.artifact,sha256:'sha256:'+'0'.repeat(64)}},{signature:'A'.repeat(86)+'=='}]) {
      const rows=f.report.waveERehearsals.map((row,i)=>i===0?{...row,...change}:row);
      assert.equal(f.evaluate({...f.report,waveERehearsals:rows}).assessment,'BLOCKED',JSON.stringify(change));
    }
  } finally {f.cleanup();}
});

test('U16: wrong-role public keys never authorize regulated rehearsals',()=>{
  const f=setup();try {
    const keys=f.trustedKeys.keys.map(item=>item.role==='finance'?{...item,role:'engineering'}:item);
    assert.equal(f.evaluate(f.report,{keys}).assessment,'BLOCKED');
    assert.ok(f.evaluate(f.report,{keys}).blockers.some(x=>x.id==='wave_e.finance-end-to-end'));
  } finally {f.cleanup();}
});

test('U16: duplicated or missing test cases and reused artifacts fail closed',()=>{
  const f=setup();try {
    const records=f.report.waveERehearsals;
    assert.equal(f.evaluate({...f.report,waveERehearsals:records.slice(1)}).assessment,'BLOCKED');
    assert.equal(f.evaluate({...f.report,waveERehearsals:[...records,records[0]]}).assessment,'BLOCKED');
    assert.equal(f.evaluate({...f.report,waveERehearsals:records.map((r,i)=>i===1?{...r,artifact:records[0].artifact}:r)}).assessment,'BLOCKED');
    assert.equal(f.evaluate({...f.report,waveERehearsals:[...records,{...records[0],id:'made-up-gate'}]}).assessment,'BLOCKED');
  } finally {f.cleanup();}
});

test('U16: stale, pre-freeze and future signatures do not authorize review',()=>{
  const f=setup();try {
    for (const ts of [now-9*day,now-200000,now+5000]) {
      const rows=f.report.waveERehearsals.map((row,i)=>i?row:{...row,testedAt:new Date(ts).toISOString()});
      assert.equal(f.evaluate({...f.report,waveERehearsals:rows}).assessment,'BLOCKED');
    }
  } finally {f.cleanup();}
});

test('U16: symlink traversal and absolute paths are rejected',()=>{
  const f=setup();try {
    symlinkSync(join(f.directory,'proofs','e-0.txt'),join(f.directory,'proofs','linked.txt'));
    for (const artifact of [
      {...f.report.waveERehearsals[0].artifact,path:'proofs/linked.txt'},
      {...f.report.waveERehearsals[0].artifact,path:'../external'},
      {...f.report.waveERehearsals[0].artifact,path:'/etc/passwd'}
    ]) {
      const rows=f.report.waveERehearsals.map((row,i)=>i?row:{...row,artifact});
      assert.equal(f.evaluate({...f.report,waveERehearsals:rows}).assessment,'BLOCKED');
    }
  } finally {f.cleanup();}
});

test('U17: production Firebase and remote emulator targets are rejected',()=>{
  const good={GCLOUD_PROJECT:'demo-spotly-wavee',FIREBASE_PROJECT_ID:'demo-spotly-wavee',
    FIREBASE_AUTH_EMULATOR_HOST:'localhost:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
    FIREBASE_DATABASE_EMULATOR_HOST:'127.0.0.1:9000',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199'};
  assert.equal(checkStagingTarget(good).assessment,'STAGING_EMULATORS_ONLY');
  for (const bad of [{GCLOUD_PROJECT:'spotly-africa'}, {FIRESTORE_EMULATOR_HOST:'cloud.test:8080'},
    {FIREBASE_PROJECT_ID:'spotly-africa'}, {SPOTLY_ALLOW_PRODUCTION_DEPLOY:'true'}, {FIREBASE_AUTH_EMULATOR_HOST:'10.0.0.9:9099'}]) {
    assert.equal(checkStagingTarget({...good,...bad}).assessment,'BLOCKED',JSON.stringify(bad));
  }
  assert.equal(checkStagingTarget({}).assessment,'BLOCKED');
});
