import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NXT_ROLES, canDelegateNxtRole, canShowDirectoryRecord, csvSafe, hasNxtPermission, isVerifiedClaim, cleanProspect } from '../lib/nxt-policy.js';
const read = p => readFileSync(join(process.cwd(), p), 'utf8');
const mock = roles => ({ roles });
test('partner roles are scoped to outreach and cannot grant platform or financial permissions',()=>{
 assert.deepEqual(Object.keys(NXT_ROLES),['nxt_manager','nxt_supervisor','nxt_outreach','nxt_analyst']);
 for(const r of Object.values(NXT_ROLES)) for(const p of ['admin.configuration','finance.read','launch.beta','billing.write']) assert.ok(!r.permissions.includes(p));
 assert.equal(hasNxtPermission(mock(['nxt_manager']),'team'),true);
 assert.equal(hasNxtPermission(mock(['nxt_analyst']),'team'),false);
 assert.equal(hasNxtPermission(mock(['nxt_outreach']),'read'),true);
 assert.equal(hasNxtPermission(mock([]),'read'),false);
});
test('only Spotly admin can promote another NXT Lead; NXT Lead delegates lesser roles',()=>{
 assert.equal(canDelegateNxtRole(mock(['nxt_manager']),'nxt_manager'),false);
 assert.equal(canDelegateNxtRole(mock(['nxt_manager']),'nxt_supervisor'),true);
 assert.equal(canDelegateNxtRole(mock(['nxt_outreach']),'nxt_analyst'),false);
 assert.equal(canDelegateNxtRole(mock(['super_admin']),'nxt_manager'),true);
});
test('unverified listings stay hidden by default while verified claims remain visible',()=>{
 const verified={public:true,claimStatus:'claimed',verificationStatus:'approved',ownerIds:['real_owner']};
 const sourced={public:true,claimStatus:'unclaimed',verificationStatus:'unverified',ownerIds:[]};
 assert.equal(isVerifiedClaim(verified),true);
 assert.equal(canShowDirectoryRecord(verified),true);
 assert.equal(canShowDirectoryRecord(sourced),false);
 assert.equal(canShowDirectoryRecord(sourced,true),true);
 assert.equal(canShowDirectoryRecord({...verified,public:false}),false);
 assert.equal(canShowDirectoryRecord({...verified,status:'suspended'}),false);
});
test('private prospect inputs do not accept claimed, publication or owner fields',()=>{
 const record=cleanProspect({name:'Test',phone:'0777',public:true,ownerIds:['a'],verificationStatus:'approved',sourceNote:'From sheet'});
 assert.deepEqual(record,{name:'Test',phone:'0777',sourceNote:'From sheet'});
 assert.equal(csvSafe('=2+3'),'"\'=2+3"');
});
test('workbook is staged privately and does not import into businesses automatically',()=>{
 const data=JSON.parse(read('data/nxt-outreach-starter.json'));
 assert.equal(data.rows.length,461);
 assert.equal(data.rows.filter(r=>r.phone).length,264);
 assert.ok(data.rows.every(r=>r.sourceId && r.name));
 const script=read('app/api/nxt/import/route.js');
 assert.match(script,/db\.collection\("nxtProspects"\)/);
 assert.match(script,/public:false/);
 assert.match(script,/body\.confirm!==true/);
});
test('authenticated server operations and claim security checks are present',()=>{
 const paths=['app/api/nxt/route.js','app/api/nxt/team/route.js','app/api/nxt/onboard/route.js','app/api/nxt/invite/route.js','app/api/nxt/evidence/route.js'];
 for(const path of paths){const c=read(path);assert.match(c,/authenticateRequest\(request\)/,path);assert.match(c,/requireNxt\(actor/,path)}
 assert.match(read('app/api/nxt/onboard/route.js'),/public:false/);
 assert.match(read('app/api/nxt/invite/route.js'),/randomBytes\(32\)/);
 assert.match(read('app/api/nxt/evidence/route.js'),/recordingConsent/);
 assert.match(read('app/api/admin/directory-visibility/route.js'),/requirePlatformPermission\(actor,"admin.configuration"\)/);
});
test('private evidence and invitations are inaccessible through direct Firestore reads',()=>{
 const rules=read('firestore.rules');
 for(const col of ['nxtProspects','nxtInteractions','nxtEvidence','nxtClaimInvites'])assert.match(rules,new RegExp(`match /${col}/\\{id\\} \\{ allow read, write: if false; \\}`));
});
test('public entry points honor default-hidden unclaimed directory policy',()=>{
 for(const p of ['app/api/public/directory/route.js','app/api/public/marketplace/route.js','app/api/public/search/route.js','app/api/public/service-feed/route.js','lib/public-seo-server.js']) assert.match(read(p),/unclaimedPublicationEnabled\(/,p);
 assert.match(read('lib/platform-defaults.js'),/publishUnclaimed: false/);
 assert.match(read('proxy.js'),/nxt\.spotlyafrica\.com/);
 assert.match(read('lib/spotly-domains.js'),/nxt\.spotlyafrica\.com/);
});
