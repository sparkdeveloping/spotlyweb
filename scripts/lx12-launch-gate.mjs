#!/usr/bin/env node
// Offline, read-only evidence verifier. Produces a MANUAL REVIEW candidate only;
// it cannot approve a launch, verify a payment, or assert staging behavior.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../contracts/spotly-launch-evidence.v1.json' with { type: 'json' };

const SHA = /^sha256:[a-f0-9]{64}$/i;
const DAY = 86_400_000;
const ID = /^[a-z0-9_-]{3,100}$/i;
const HERE = dirname(fileURLToPath(import.meta.url));
const VALID_CITIES = JSON.parse(readFileSync(join(HERE,'../contracts/spotly-countries.v1.json'),'utf8')).countries;
const countryCities = Object.fromEntries(VALID_CITIES.map(c=>[c.code,new Set(c.cities.map(city=>city.name))]));
export const LX12_CONFIG = config;
export const requiredIds = (scopes) => {
  const ids = new Set(config.globalGates.map(id=>`global.${id}`));
  for (const scope of scopes) {
    const prefix = `${scope.country}.${scope.city}`;
    ids.add(`scope.${prefix}.release_flags`);
    for (const check of config.perCityGates) ids.add(`city.${prefix}.${check}`);
    for (const service of config.services) {
      const status = scope.services[service];
      const checks = status === 'live' ? config.perServiceGates[service] : config.perDisabledServiceGates;
      for (const check of checks) ids.add(`service.${prefix}.${service}.${check}`);
    }
  }
  return [...ids].sort();
};

function safeEvidenceFile(directory, artifact) {
  const path = artifact?.path;
  if (typeof path !== 'string' || !path || isAbsolute(path) || path.includes('\\') || !SHA.test(String(artifact?.sha256||''))) return false;
  const absolute = resolve(directory,path);
  const rel = relative(directory,absolute);
  if (rel === '..' || rel.startsWith('..'+sep) || isAbsolute(rel) || !existsSync(absolute)) return false;
  const real = realpathSync(absolute);
  const root = realpathSync(directory);
  const realRel = relative(root,real);
  if (realRel === '..' || realRel.startsWith('..'+sep) || isAbsolute(realRel) || !statSync(real).isFile()) return false;
  // Evidence records must not link to large archives or secrets; keep proofs concise.
  if (statSync(real).size > 10_000_000) return false;
  const actual='sha256:'+createHash('sha256').update(readFileSync(real)).digest('hex');
  return actual === artifact.sha256.toLowerCase();
}

function validRecord(record, {candidate, directory, now}) {
  if (!record || record.status !== 'passed' || !ID.test(String(record.operator || '')) || !ID.test(String(record.reviewer || '')) || record.operator===record.reviewer) return false;
  if (record.buildDigest !== candidate.buildDigest || record.environment !== 'staging' || record.artifact?.sha256===undefined) return false;
  const testedAt=Date.parse(record.testedAt);
  const freeze=Date.parse(candidate.frozenAt);
  if (!Number.isFinite(testedAt) || !Number.isFinite(freeze) || testedAt < freeze || testedAt > now || now-testedAt > 7*DAY) return false;
  return safeEvidenceFile(directory,record.artifact);
}

export function evaluateLX12Release(report, {directory='.', now=Date.now()} = {}) {
  const blockers=[];
  const add=(id,reason)=>blockers.push({id,reason});
  const candidate=report?.candidate;
  if (!SHA.test(String(candidate?.buildDigest||'')) || !ID.test(String(candidate?.sourceRef||'')) || candidate?.environment!=='staging' || !Number.isFinite(Date.parse(candidate?.frozenAt||''))) add('candidate','Frozen staging build digest, source ref and timestamp are required');
  if (Date.parse(candidate?.frozenAt||'') > now || now-Date.parse(candidate?.frozenAt||'') > 7*DAY) add('candidate.freshness','Candidate must be frozen within seven days');
  const scopes = report?.scopes;
  if (!Array.isArray(scopes) || !scopes.length) add('scopes','At least one explicitly selected city scope is required');
  const validScopes=[]; const keys=new Set();
  for (const scope of Array.isArray(scopes)?scopes:[]) {
    const key=`${scope?.country}.${scope?.city}`;
    if (keys.has(key)) { add(`scope.${key}`,'Duplicate city scope'); continue; }
    keys.add(key);
    if (!countryCities[scope?.country]?.has(scope?.city) || !scope?.services || config.services.some(id=>!['live','disabled'].includes(scope.services[id])) || Object.keys(scope.services).some(id=>!config.services.includes(id))) {
      add(`scope.${key}`,'Unsupported city, missing service or invalid scope state'); continue;
    }
    validScopes.push(scope);
  }
  for (const country of config.countryCodes) if (!validScopes.some(scope=>scope.country===country)) add(`country.${country}`,'Country requires a launch or explicit disabled-scope decision for at least one supported city');
  const required = requiredIds(validScopes);
  const records = new Map();
  for (const r of Array.isArray(report?.evidence)?report.evidence:[]) {
    const id = String(r?.id||'');
    if (records.has(id)) {add(`evidence.${id}`,'Duplicate evidence id');continue;}
    records.set(id,r);
    if (!required.includes(id)) add(`evidence.${id}`,'Unrecognized evidence id cannot substitute for a required check');
  }
  let passed=0;
  for (const id of required) {
    if (!records.has(id)) {add(id,'Missing independently reviewed evidence');continue;}
    if (!validRecord(records.get(id),{candidate:candidate||{},directory,now})) {add(id,'Evidence is failed, unreviewed, stale, not staging-bound or artifact hash invalid');continue;}
    passed++;
  }
  return {
    decision: 'NO_GO', // A local script must never authorize a production launch.
    assessment: blockers.length===0 ? 'READY_FOR_MANUAL_REVIEW' : 'BLOCKED',
    verifiedEvidence:passed,
    requiredEvidence:required.length,
    blockers,
    caveat:'Evidence integrity and metadata checks do not prove that real journeys passed. Human review, staging verification, legal clearance and explicit release approval are required.'
  };
}

const called = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (called) {
  const filename=process.argv[2];
  try {
    const path=filename ? resolve(filename) : '';
    const report=path&&existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
    const result=evaluateLX12Release(report,{directory:path?dirname(path):process.cwd()});
    if (process.argv.includes('--json')) console.log(JSON.stringify(result,null,2));
    else {
      console.log(`Spotly LX12: ${result.assessment} · production ${result.decision} · ${result.verifiedEvidence}/${result.requiredEvidence} evidence items verified`);
      for (const item of result.blockers.slice(0,80)) console.log(`BLOCK ${item.id}: ${item.reason}`);
      if (result.blockers.length>80) console.log(`...${result.blockers.length-80} further blockers`);
      console.log(result.caveat);
    }
    if (result.assessment!=='READY_FOR_MANUAL_REVIEW') process.exitCode=1;
  } catch(e){ console.error(`LX12 evidence could not be evaluated: ${e.message}`);process.exitCode=2; }
}
