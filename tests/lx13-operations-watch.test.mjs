import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeIncidentSample,summarizeOperationsWatch} from '../lib/lx13-operations-watch.mjs';
const source=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const incident=(fingerprint, status='open',date='2026-11-15T09:00:00.000Z')=>({fingerprint,status,screen:'/ride',errorClass:'TypeError',createdAt:date});

test('incident grouping counts reports, never unique users or a success rate',()=>{
  const data=summarizeIncidentSample([incident('a'.repeat(24)),incident('a'.repeat(24)),incident('b'.repeat(24),'resolved')]);
  assert.equal(data.observed,3);
  assert.equal(data.groups[0].count,2);
  assert.equal(data.groups[0].openObserved,2);
  assert.equal(data.groups[1].openObserved,0);
  assert.equal('failureRate' in data,false);
});
test('incident sample is bounded to 40 and signals truncation',()=>{
  const data=summarizeIncidentSample(Array.from({length:50},()=>incident('a'.repeat(24))));
  assert.equal(data.observed,40); assert.equal(data.truncatedOrUnknown,true);
});
test('incident aggregation ignores unsafe fingerprints and URLs',()=>{
  const data=summarizeIncidentSample([{...incident('PII:user:123'),screen:'/rides/12345?token=private',errorClass:'X',createdAt:'invalid'}]);
  assert.equal(data.groups[0].fingerprint,'unclassified');
  assert.equal(data.groups[0].screen,'/');
  assert.equal(data.groups[0].errorClass,'Other');
});
test('missing data is unavailable, not healthy',()=>{
  const model=summarizeOperationsWatch(null,null,{incidentsAvailable:false});
  assert.equal(model.state,'unavailable'); assert.equal(model.signals.length,0); assert.equal(model.incidents,null);
});
test('nonzero operational counters are for human review',()=>{
  const model=summarizeOperationsWatch({health:{appCheckEnforced:true,staleDriverPresence:2,unresolvedDriverIncidents:0,paymentExceptions:0,recentRatePressure:0}},[],{incidentsAvailable:true});
  assert.equal(model.state,'needs_review');
  assert.equal(model.signals.find(x=>x.id==='staleDriverPresence').value,2);
});
test('zero observed counts cannot be misrepresented as platform-wide good health',()=>{
  const model=summarizeOperationsWatch({health:{appCheckEnforced:true,staleDriverPresence:0,unresolvedDriverIncidents:0,paymentExceptions:0,recentRatePressure:0}},[],{incidentsAvailable:true});
  assert.equal(model.state,'observed_only');
  assert.ok(model.limitations.join(' ').includes('not full-system totals'));
  assert.doesNotMatch(JSON.stringify(model),/"state":"healthy"/);
});
test('bad negative and partial numbers are unavailable',()=>{
  const model=summarizeOperationsWatch({health:{appCheckEnforced:false,paymentExceptions:-5,staleDriverPresence:'0'}},[],{incidentsAvailable:true});
  assert.equal(model.state,'needs_review');
  assert.equal(model.signals.find(x=>x.id==='paymentExceptions').value,null);
});
test('admin health still requires admin.configuration and returns bounded coverage',()=>{
  const route=source('app/api/admin/operations-health/route.js');
  assert.match(route,/authenticateRequest\(request\)/); assert.match(route,/requirePlatformPermission\(actor, "admin.configuration"\)/);
  assert.match(route,/coverage:/); assert.match(route,/bounded_observation/);
});
test('Operations watch reuses existing endpoints, remains mounted only on explicit tab and cannot mutate services',()=>{
  const component=source('components/admin-operations-watch.js');const admin=source('components/admin-app.js');
  assert.match(component,/\/api\/admin\/operations-health/);assert.match(component,/\/api\/admin\/client-incidents/);
  assert.match(component,/document.visibilityState/);assert.match(component,/5 \* 60_000/);
  assert.doesNotMatch(component,/method:\s*['"]POST|collection\(|deleteDoc\(|updateDoc\(|serviceAvailabilityControl/);
  assert.match(admin,/value:"monitoring",label:"Operations watch"/);
  assert.match(admin,/tab==="monitoring"\?<AdminOperationsWatch/);
});
test('Platform Map health polling pauses when hidden, and is capped at five minutes',()=>{
  const component=source('components/platform-map.js');
  assert.match(component,/visibilitychange/);assert.match(component,/lastCheckAt/);
  assert.match(component,/5 \* 60_000/);
  assert.match(component,/Observed samples only/);
});
