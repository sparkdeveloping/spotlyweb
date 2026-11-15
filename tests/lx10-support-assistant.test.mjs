import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { routeHarness } from './helpers/route-harness.mjs';
import * as assistant from '../lib/spotly-support-assistant.mjs';

const root = resolve(import.meta.dirname, '..');
const source = file => readFileSync(resolve(root, file), 'utf8');
const req = question => new Request('https://spotlyafrica.com/api/support/assistant', { method:'POST', headers: { 'content-type':'application/json' }, body:JSON.stringify({ question }) });
const env = ['SPOTLY_SUPPORT_ASSISTANT_ENABLED','SPOTLY_SUPPORT_ASSISTANT_PUBLIC_KB','SPOTLY_SUPPORT_ASSISTANT_PROVIDER','SPOTLY_CLOUDFLARE_ACCOUNT_ID','SPOTLY_CLOUDFLARE_AI_TOKEN'];
async function withEnv(changes, fn) {
  const old = Object.fromEntries(env.map(key => [key, process.env[key]]));
  for (const key of env) { if (Object.hasOwn(changes,key)) process.env[key]=changes[key]; else delete process.env[key]; }
  try { return await fn(); } finally { for (const key of env) { if (old[key]===undefined) delete process.env[key]; else process.env[key]=old[key]; } }
}
function setup({ appCheckFailure = false } = {}) {
  const check = { app:0, auth:0, quota:[], fetched:0 };
  const h = routeHarness(root, {
    '@/lib/spotly-support-assistant.mjs': assistant,
    '@/lib/firebase-admin': {
      verifyAppCheckRequest:async (_, options)=>{ check.app++; assert.equal(options.required,true); if (appCheckFailure) throw Object.assign(new Error('App Check needed'),{status:401}); },
      authenticateRequest:async()=>{ check.auth++; return {uid:'customer-1', firebase: { sign_in_provider:'password' }}; },
      getAdminServices:()=>({db:h.db}),
      apiError:error=>Response.json({ok:false,error:error.message},{status:error.status||500})
    },
    '@/lib/rate-limit-server': { enforceRateLimit: async (_req, rule)=>{check.quota.push(rule); } }
  });
  return { route:h.load('app/api/support/assistant/route.js'), h, check };
}

test('LX10: disabled AI does not authenticate, read Firestore or spend inference', async()=>withEnv({},async()=>{
  const {route,check}=setup(); const response=await route.POST(req('How do I track an order?'));
  assert.equal(response.status,503); assert.equal(check.auth,0); assert.equal(check.quota.length,0);
}));

test('LX10: App Check denies request before authentication and data access',async()=>withEnv({SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true'},async()=>{
  const {route,check}=setup({appCheckFailure:true});
  assert.equal((await route.POST(req('Where are my orders?'))).status,401);
  assert.equal(check.app,1); assert.equal(check.auth,0); assert.equal(check.quota.length,0);
}));

test('LX10: help answers are limited to grounded public guidance and contain source links',async()=>withEnv({SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true'},async()=>{
  const {route,check}=setup(); const res=await route.POST(req('How do I track my delivery?'));
  assert.equal(res.status,200); const data=await res.json();
  assert.equal(data.provider,'approved-guidance'); assert.equal(data.handoff,false);
  assert.match(data.answer,/Activity/); assert.equal(data.sources[0].href,'/activity');
  assert.equal(check.app,1); assert.equal(check.quota.length,2);
}));

test('LX10: no matching guidance does not invent service or payment facts',async()=>withEnv({SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true'},async()=>{
  const {route}=setup(); const res=await route.POST(req('Do you offer underwater bicycle rentals on Mars?'));
  const data=await res.json(); assert.equal(data.handoff,true); assert.equal(data.provider,'none');
  assert.equal(data.sources.length,0); assert.match(data.answer,/support team/i);
}));

test('LX10: sensitive cases never call external provider',async()=>withEnv({SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true',SPOTLY_SUPPORT_ASSISTANT_PROVIDER:'cloudflare'},async()=>{
  const {route}=setup();const res=await route.POST(req('I had an accident and the driver is unsafe'));
  const data=await res.json(); assert.equal(data.handoff,true); assert.equal(data.provider,'none'); assert.match(data.answer,/support request/i);
}));

test('LX10: email, phone and access codes are not passed to the assistant',()=>{
  for(const q of ['Send updates to user@example.com please','My phone is +265 991 123 456','My OTP is 918274','My card number is 4111111111111111']){
    assert.equal(assistant.inspectSupportQuestion(q).safe,false,q);
  }
});

test('LX10: unpublished and staff-only knowledge never enters public answers',()=>{
  assert.equal(assistant.publicKnowledgeRecord('s1',{title:'Staff protocol',description:'Internal key',published:true,audience:['staff']}),null);
  assert.equal(assistant.publicKnowledgeRecord('s2',{title:'Draft',description:'Not final',published:false,audience:['public']}),null);
  const entry=assistant.publicKnowledgeRecord('pub',{title:'Map search',description:'Confirm a landmark using the map',published:true,audience:['public']});
  assert.equal(entry.href,'/support'); assert.equal(assistant.selectSupportKnowledge('landmark map',[entry]).some(x=>x.id==='published-pub'),true);
});

test('LX10: public knowledge query is opt-in, bounded and only uses public audience',async()=>withEnv({SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true',SPOTLY_SUPPORT_ASSISTANT_PUBLIC_KB:'true'},async()=>{
  const {route,h}=setup();
  h.records.set('helpResources/first',{published:true,audience:['public'],title:'Delivery hours',description:'View availability in the app.'});
  h.records.set('helpResources/private',{published:true,audience:['staff'],title:'Delivery secret',description:'Never publish this.'});
  const result=await route.POST(req('How do I track a delivery?'));
  assert.equal(result.status,200);
  const data=await result.json(); assert.equal(JSON.stringify(data).includes('Delivery secret'),false);
}));

test('LX10: provider can be enabled independently and only with credentials',async()=>withEnv({SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true',SPOTLY_SUPPORT_ASSISTANT_PROVIDER:'cloudflare'},async()=>{
  const {route,check}=setup(); const data=await (await route.POST(req('How can I track my order?'))).json();
  assert.equal(data.provider,'approved-guidance'); assert.ok(check.quota.some(q=>q.key==='lx10-assistant-cloudflare-daily'));
}));

test('LX10: output filters unsupported promises and unsupported source claims',()=>{
  const sources=assistant.selectSupportKnowledge('payment');
  assert.equal(assistant.verifiedAssistantReply('Your payment has been confirmed',sources),assistant.fallbackAssistantReply(sources));
  assert.equal(assistant.verifiedAssistantReply('Approved guide says check Activity.',[]),assistant.fallbackAssistantReply([]));
});

test('LX10: separate controls leave the assistant off by default and human support always accessible',()=>{
  assert.match(source('.env.example'),/SPOTLY_SUPPORT_ASSISTANT_ENABLED=false/);
  assert.match(source('.env.example'),/NEXT_PUBLIC_SPOTLY_SUPPORT_ASSISTANT_ENABLED=false/);
  assert.match(source('components/spotly-support-assistant.js'),/Spotly Assistant · AI/);
  assert.match(source('components/spotly-support-assistant.js'),/Message human support/);
  assert.match(source('components/tickets-app.js'),/SpotlySupportAssistant/);
  assert.match(source('components/support-app.js'),/SpotlySupportAssistant/);
  assert.match(source('components/tickets-app.js'),/request_callback/);
});

test('LX10: Cloudflare inference uses only the fixed approved endpoint and bounded public context',async()=>withEnv({
  SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true', SPOTLY_SUPPORT_ASSISTANT_PROVIDER:'cloudflare',
  SPOTLY_CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',SPOTLY_CLOUDFLARE_AI_TOKEN:'test-only'
},async()=>{
  const oldFetch=globalThis.fetch;
  const observed=[];
  globalThis.fetch=async (url,options)=>{
    observed.push({url,options});
    return new Response(JSON.stringify({success:true,result:{response:'Open Activity to review the existing delivery status.'}}),{status:200});
  };
  try {
    const {route}=setup();const response=await route.POST(req('How do I track delivery?'));
    assert.equal(response.status,200);
    const body=await response.json(); assert.equal(body.provider,'cloudflare');
    assert.equal(observed.length,1);assert.match(observed[0].url,/api.cloudflare.com\/client\/v4\/accounts\/0123456789abcdef0123456789abcdef\/ai\/run\/@cf\/meta\/llama-3.1-8b-instruct/);
    assert.equal(JSON.parse(observed[0].options.body).max_tokens,180);
    assert.equal(body.sources.length>0,true);
    assert.equal(JSON.stringify(body).includes('test-only'),false);
  } finally { globalThis.fetch=oldFetch; }
}));

test('LX10: provider failure returns guidance rather than a fabricated answer',async()=>withEnv({
  SPOTLY_SUPPORT_ASSISTANT_ENABLED:'true', SPOTLY_SUPPORT_ASSISTANT_PROVIDER:'cloudflare',
  SPOTLY_CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',SPOTLY_CLOUDFLARE_AI_TOKEN:'test-only'
},async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response('{}',{status:503});
  try {
    const {route}=setup();const response=await route.POST(req('How do I track a delivery?'));
    assert.equal(response.status,200);
    const body=await response.json(); assert.equal(body.provider,'approved-guidance');
    assert.match(body.answer,/Activity/);
  } finally {globalThis.fetch=oldFetch;}
}));

test('LX10: native apps retain their support and link to real ticket/callback route',()=>{
  for (const file of [
    '../../customer/spotly/spotly/Features/Production/ProfileSupportNotifications.swift',
    '../../driver/spotlydriver/spotlydriver/Features/Support/SupportViews.swift',
    '../../business/spotlybusiness/spotlybusiness/Features/Profile/SupportView.swift'
  ]) {
    assert.match(source(file),/https:\/\/spotlyafrica\.com\/support/);
    assert.match(source(file),/https:\/\/spotlyafrica\.com\/tickets/);
  }
});
