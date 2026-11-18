import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as registration from '../lib/business-registration-policy.mjs';
import { readPendingRegistration, savePendingRegistration, clearPendingRegistration, PENDING_REGISTRATION_KEY } from '../lib/business-registration-continuation-client.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const src = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const key='c230c7d9-e3b2-42a7-8f30-09449dc35113';
const leadId=registration.registrationDocumentId(key,'ZW','+263770000000');
const now=Date.now();
const timestamp=(millis=now)=>({toMillis:()=>millis,toDate:()=>new Date(millis)});
function chain(){const x={parse:value=>value};for(const name of ['min','max','regex','trim','email','optional','default','refine'])x[name]=()=>x;return x;}
const z={string:chain,object:chain,enum:chain,literal:chain,discriminatedUnion:()=>chain(),ZodError:class ZodError extends Error{}};
function harness(){
  const leads=new Map([[leadId,{applicantName:'Example Person',businessName:'Corner Store',phone:'+263770000000',email:'a@example.com',city:'Harare',country:'ZW',category:'Shops',roleAtBusiness:'owner',createdAt:timestamp(),status:'new',continuationProof:registration.continuationProof(key,leadId),applicantUid:null,linkedClaimId:null}]]);
  const claims=new Map(); const memberships=new Map(); const audit=[];
  const db={collection(name){return {where(field,comparison,uid){return {limit(max){return {async get(){return {docs:[...leads.entries()].filter(([,data])=>data[field]===uid).slice(0,max).map(([id,data])=>({id,data:()=>data}))};}};}};},doc(id){const id1=id || `log-${audit.length+1}`;const records=name==='businessRegistrations'?leads:name==='businessClaims'?claims:memberships;return {id:id1, async get(){const item=records.get(id1);return {id:id1,exists:Boolean(item),data:()=>item};}};}};},
    async runTransaction(operation){const writes=[];const tx={get:ref=>ref.get(),update:(ref,data)=>writes.push({op:'update',ref,data}),create:(ref,data)=>writes.push({op:'create',ref,data})};const result=await operation(tx);for(const w of writes){if(w.ref.id.startsWith('log-'))audit.push(w.data);else if(w.op==='update')leads.set(w.ref.id,{...leads.get(w.ref.id),...w.data});else throw Error('Unexpected created record.');}return result;}};
  let actor={uid:'real-owner',email:'owner@example.com'};
  const mocks={
    'firebase-admin/firestore':{FieldValue:{serverTimestamp:()=>timestamp()}},
    'node:crypto':require('node:crypto'),
    zod:{z},
    '@/lib/firebase-admin':{apiError:err=>Response.json({ok:false,error:err.message},{status:err.status||500}),authenticateRequest:async request=>{if(request.headers.get('authorization')!=='Bearer valid')throw Object.assign(Error('Not signed in'),{status:401});return actor;},getAdminServices:()=>({db})},
    '@/lib/rate-limit-server':{enforceRateLimit:async()=>({remaining:5})},
    '@/lib/business-registration-policy.mjs':registration
  };
  const js=ts.transpileModule(src('app/api/business-registrations/continue/route.js'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(js,{require:name=>{if(!Object.hasOwn(mocks,name))throw Error('Unexpected module '+name);return mocks[name];},module,exports:module.exports,Response,Buffer,Date,console,URL},{filename:'business-continuation-route.js'});
  const req=payload=>new Request('https://business.spotlyafrica.com/api/business-registrations/continue',{method:'POST',headers:{authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify(payload)});
  return {route:module.exports,req,leads,claims,audit,memberships,setActor:next=>actor=next};
}

test('continuation proof cannot be inferred from lead ID, contact fields or a different key',()=>{
  const a=registration.continuationProof(key,leadId);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.notEqual(a,registration.continuationProof('f230c7d9-e3b2-42a7-8f30-09449dc35113',leadId));
  assert.notEqual(a,registration.continuationProof(key,'br_'+ 'e'.repeat(40)));
  assert.ok(!a.includes('263770000000'));
});
test('browser continuation is session-only, excludes contact PII and can be cleared',()=>{
  const memory=new Map();const store={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  assert.equal(savePendingRegistration(store,leadId,key),true);
  assert.deepEqual(readPendingRegistration(store),{registrationId:leadId,continuationKey:key});
  assert.doesNotMatch(memory.get(PENDING_REGISTRATION_KEY),/\+263|example\.com|Corner Store/);
  clearPendingRegistration(store);assert.equal(readPendingRegistration(store),null);
});
test('continuation rejects unauthenticated users and guessed proofs',async()=>{
 const h=harness();
 const anon=await h.route.POST(new Request('https://business.spotlyafrica.com/api/business-registrations/continue',{method:'POST',body:JSON.stringify({action:'continue',registrationId:leadId,continuationKey:key})}));assert.equal(anon.status,401);
 const bad=await h.route.POST(h.req({action:'continue',registrationId:leadId,continuationKey:'a230c7d9-e3b2-42a7-8f30-09449dc35113'}));assert.equal(bad.status,403);
 assert.equal(h.leads.get(leadId).applicantUid,null);
});
test('authenticated continuation links only applicant identity, not merchant membership',async()=>{
 const h=harness();const payload={action:'continue',registrationId:leadId,continuationKey:key};
 const r=await h.route.POST(h.req(payload));assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.businessName,'Corner Store');assert.equal(body.registrationId,leadId);
 assert.equal(h.leads.get(leadId).applicantUid,'real-owner');assert.equal(h.memberships.size,0);assert.equal(h.audit.length,1);
 const retry=await h.route.POST(h.req(payload));assert.equal(retry.status,200);assert.equal(h.audit.length,1);
 h.setActor({uid:'another-person'});const other=await h.route.POST(h.req(payload));assert.equal(other.status,409);
});
test('only a submitted claim owned by the same applicant can be associated with a lead',async()=>{
 const h=harness();await h.route.POST(h.req({action:'continue',registrationId:leadId,continuationKey:key}));
 h.claims.set('business_own',{applicantId:'real-owner',status:'submitted'});
 h.claims.set('business_other',{applicantId:'other-person',status:'submitted'});
 const invalid=await h.route.POST(h.req({action:'link_claim',registrationId:leadId,claimId:'business_other'}));assert.equal(invalid.status,409);
 const valid=await h.route.POST(h.req({action:'link_claim',registrationId:leadId,claimId:'business_own'}));assert.equal(valid.status,200);
 assert.equal(h.leads.get(leadId).linkedClaimId,'business_own');assert.equal(h.memberships.size,0);
 const repeat=await h.route.POST(h.req({action:'link_claim',registrationId:leadId,claimId:'business_own'}));assert.equal(repeat.status,200);assert.equal(h.audit.length,2);
});
test('expired unlinked continuation is rejected while earlier leads remain available to staff',async()=>{
 const h=harness();h.leads.get(leadId).createdAt=timestamp(now-16*86400000);
 const r=await h.route.POST(h.req({action:'continue',registrationId:leadId,continuationKey:key}));assert.equal(r.status,410);
 assert.equal(h.leads.has(leadId),true);
});
test('end-to-end source preserves existing claims and tracks applicants without approval',()=>{
 const ui=src('components/claim-app.js'), short=src('components/simple-business-registration.js'), admin=src('components/admin-business-registrations.js'), api=src('app/api/public/business-registrations/route.js');
 assert.match(ui,/readPendingRegistration\(window\.sessionStorage\)/);
 assert.match(ui,/action: "link_claim"/);
 assert.match(ui,/stageClaimFile\(draftId, file\)/);
 assert.match(ui,/authenticatedFetch\("\/api\/business-claims\/submit"/);
 assert.match(short,/savePendingRegistration/);
 assert.match(api,/continuationProof:continuationProof/);
 assert.doesNotMatch(api,/x-registrations-password/);
 assert.match(admin,/Take follow-up/);
 assert.match(admin,/Private follow-up note/);
 assert.match(src('components/business/business-account.js'),/get-started/);
});
test('Admin private follow-up notes remain out of broadly indexed audit metadata',()=>{
 const api=src('app/api/public/business-registrations/route.js');
 assert.match(api,/ref\.collection\("events"\)/);
 assert.match(api,/hasPrivateNote/);
 assert.doesNotMatch(api,/metadata:\{[^}]*note:change\.note/s);
 assert.match(api,/previousAssignee&&previousAssignee!==actor\.uid/);
 assert.match(api,/Only the assigned team member can release/);
 assert.match(api,/requireRead\(actor\)/);
});

test('first-time merchant sees only the leads linked to their own signed-in UID',async()=>{
 const h=harness();
 await h.route.POST(h.req({action:'continue',registrationId:leadId,continuationKey:key}));
 const mine=await h.route.GET(new Request('https://business.spotlyafrica.com/api/business-registrations/continue',{headers:{authorization:'Bearer valid'}}));
 assert.equal(mine.status,200);const body=await mine.json();assert.equal(body.registrations.length,1);
 assert.equal(body.registrations[0].businessName,'Corner Store');
 assert.equal(body.registrations[0].phone,undefined);
 h.setActor({uid:'unrelated-user'});
 const other=await h.route.GET(new Request('https://business.spotlyafrica.com/api/business-registrations/continue',{headers:{authorization:'Bearer valid'}}));
 assert.equal(other.status,200);assert.deepEqual((await other.json()).registrations,[]);
});
