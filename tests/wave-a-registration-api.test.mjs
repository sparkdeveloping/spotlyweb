import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import * as policy from '../lib/business-registration-policy.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const SRC = fs.readFileSync(new URL('../app/api/public/business-registrations/route.js', import.meta.url), 'utf8');
const chain = () => {
  const obj = { parse: (x) => x };
  for (const prop of ['trim', 'min', 'max', 'regex', 'email', 'default', 'optional', 'refine']) obj[prop] = () => obj;
  return obj;
};
const z = { object: () => chain(), string: chain, literal: chain, enum: chain, union: chain };
function harness() {
  const records = new Map(); const audit = []; const events = new Map();
  const docs = (name) => ({
    doc(id) { const key = id || `audit-${audit.length+1}`; return { id: key,
      collection(sub) { return {doc() {return {id:`evt-${events.size+1}`,isEvent:true,parentId:key};},orderBy() {return {limit() {return {async get() {return {docs:[...events.entries()].filter(([eid,e])=>e.parentId===key).map(([id,item])=>({id,data:()=>item.data}))};}};}};}};},
      async create(data) { if (records.has(key)) throw Object.assign(new Error('already exists'),{code:6}); records.set(key,data); },
      async get() { const data=records.get(key);return {exists:Boolean(data),id:key,data:()=>data,toDate:()=>new Date()};},
    }; },
    orderBy() { return { limit(limit) { return {startAfter(){return this;},async get(){const matching=[...records.entries()].filter(([key])=>key.startsWith('br_'));return {size:Math.min(matching.length,limit),docs:matching.slice(0,limit).map(([id,data])=>({id,data:()=>data}))};}};}};}
  });
  const db = { collection: docs, async runTransaction(cb) {return cb({get:ref=>ref.get(),update(ref,changes){records.set(ref.id,{...records.get(ref.id),...changes});},create(ref,entry){if(ref.isEvent)events.set(ref.id,{parentId:ref.parentId,data:entry});else audit.push(entry);}});} };
  let actor=null;
  const mocks={
    'firebase-admin/firestore': {FieldValue:{serverTimestamp:()=>({toDate:()=>new Date('2026-11-18T00:00:00Z')})}},
    'zod': {z},
    '@/lib/firebase-admin': {apiError:err=>Response.json({ok:false,error:err.message},{status:err.status||500}),getAdminServices:()=>({db}), verifyAppCheckRequest:async()=>{},authenticateRequest:async request=>{if(request.headers.get('authorization')!=='Bearer valid')throw Object.assign(new Error('Authentication is required.'),{status:401});return actor||{uid:'unprivileged',profile:{roles:['customer']}};}},
    '@/lib/access-control-server': {requirePlatformPermission:(user)=>{if(!user.profile.roles.includes('admin'))throw Object.assign(new Error('Forbidden'),{status:403});}},
    '@/lib/rate-limit-server': {enforceRateLimit:async()=>({remaining:5})},
    '@/lib/country-engine': {normalizeCountryCode:s=>['ZW','MW'].includes(s)?s:'',countryCity:(_,s)=>({name:s})},
    '@/lib/business-registration-policy.mjs': policy,
  };
  const output=ts.transpileModule(SRC,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};vm.runInNewContext(output,{module:mod,exports:mod.exports,require:name=>{if(!(name in mocks))throw Error('unmocked '+name);return mocks[name];}, Response, URL, console},{filename:'wave-a-registration-api.js'});
  return {api:mod.exports,records,audit,events,setActor:value=>actor=value};
}
const endpoint='https://business.spotlyafrica.com/api/public/business-registrations';
const get = (auth, password='')=>new Request(endpoint,{headers:{...(auth?{authorization:'Bearer valid'}:{}),...(password?{'x-registrations-password':password}:{})}});
const post=key=>new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotencyKey:key,applicantName:'Test Applicant',phone:'+263770000000',email:'',roleAtBusiness:'owner',contactPreference:'phone',businessName:'A Sample Shop',registrationStatus:'not_registered',category:'Shop',country:'ZW',city:'Harare',notes:'',contactConsent:true})});

test('Wave A routes reject old shared passwords and unauthenticated registrations listing',async()=>{
 const h=harness(); let r=await h.api.GET(get(false,'old-password'));
 assert.equal(r.status,401);r=await h.api.GET(get(true));assert.equal(r.status,403);
 h.setActor({uid:'staff',profile:{roles:['admin']}});r=await h.api.GET(get(true));assert.equal(r.status,200);
 const body=await r.json();assert.deepEqual(body.registrations,[]);
});

test('Wave A public intake is create-only, idempotent and never creates memberships',async()=>{
 const h=harness(),key='c230c7d9-e3b2-42a7-8f30-09449dc35113';
 const first=await h.api.POST(post(key)),second=await h.api.POST(post(key));
 assert.equal(first.status,201);assert.equal(second.status,201);
 const a=await first.json(),b=await second.json();assert.equal(a.registrationId,b.registrationId);
 assert.equal(h.records.size,1); assert.equal(h.records.get(a.registrationId).status,'new');
 assert.equal(h.records.get(a.registrationId).linkedClaimId,null); assert.equal(h.audit.length,0);
});

test('Wave A staff updates remain authorized and atomically audited',async()=>{
 const h=harness();const first=await h.api.POST(post('c230c7d9-e3b2-42a7-8f30-09449dc35113'));
 const id=(await first.json()).registrationId;
 const update=()=>new Request(endpoint,{method:'PATCH',headers:{authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({id,status:'contacted',note:'Follow-up scheduled'})});
 let r=await h.api.PATCH(update());assert.equal(r.status,403);
 h.setActor({uid:'staff',profile:{roles:['admin']}});r=await h.api.PATCH(update());assert.equal(r.status,200);
 assert.equal(h.records.get(id).status,'contacted');assert.equal(h.audit.length,1);
 assert.equal(h.audit[0].actorId,'staff');assert.equal(h.audit[0].action,'business_registration.updated');
});

test('Wave B staff can take, release and annotate follow-ups without leaking notes into global audit',async()=>{
 const h=harness(); const first=await h.api.POST(post('c230c7d9-e3b2-42a7-8f30-09449dc35113'));
 const id=(await first.json()).registrationId;
 const update=(body)=>new Request(endpoint,{method:'PATCH',headers:{authorization:'Bearer valid','Content-Type':'application/json'},body:JSON.stringify({id,...body})});
 h.setActor({uid:'case-worker-1',profile:{roles:['admin']}});
 let response=await h.api.PATCH(update({assignmentAction:'claim'}));assert.equal(response.status,200);
 assert.equal(h.records.get(id).assignedTo,'case-worker-1');
 response=await h.api.PATCH(update({note:'Applicant asked to call in the morning.'}));assert.equal(response.status,200);
 assert.ok([...h.events.values()].some(e=>e.data.note.includes('Applicant asked')));
 assert.ok(h.audit.every(e=>!JSON.stringify(e).includes('Applicant asked')));
 const history=await h.api.GET(new Request(endpoint+'?history='+id,{headers:{authorization:'Bearer valid'}}));assert.equal(history.status,200);
 assert.ok((await history.json()).history.some(e=>e.note.includes('Applicant asked')));
 h.setActor({uid:'case-worker-2',profile:{roles:['admin']}});
 response=await h.api.PATCH(update({assignmentAction:'claim'}));assert.equal(response.status,409);
 response=await h.api.PATCH(update({assignmentAction:'release'}));assert.equal(response.status,403);
 h.setActor({uid:'case-worker-1',profile:{roles:['admin']}});
 response=await h.api.PATCH(update({assignmentAction:'release'}));assert.equal(response.status,200);
 assert.equal(h.records.get(id).assignedTo,'');
});
