import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const fsread=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const registration=await import('../lib/business-registration-policy.mjs');

test('public lead IDs are stable for a request and never contain phone numbers',()=>{
 const key='c230c7d9-e3b2-42a7-8f30-09449dc35113';
 const a=registration.registrationDocumentId(key,'ZW','+263771234567');
 assert.match(a,/^br_[a-f0-9]{40}$/);assert.equal(a,registration.registrationDocumentId(key,'ZW','+263 77 123 4567'));
 assert.notEqual(a,registration.registrationDocumentId(key,'MW','+263771234567'));
 assert.ok(!a.includes('263771234567'));
 assert.equal(registration.registrationDocumentId('short','ZW','123'),'');
});

test('legacy claim UI survives as separate component; old draft links land in verification',()=>{
 const claims=fsread('components/claim-app.js');
 const lead=fsread('components/simple-business-registration.js');
 const start=fsread('app/business/get-started/page.js');
 const verify=fsread('app/business/get-started/verify/page.js');
 assert.match(claims,/stageClaimFile\(draftId, file\)/);
 assert.match(claims,/authenticatedFetch\("\/api\/business-claims\/submit"/);
 assert.match(start,/params\?\.draft/);assert.match(start,/get-started\/verify/);
 assert.match(verify,/ClaimApp/);assert.match(lead,/SimpleBusinessRegistration/);
 assert.match(lead,/contactConsent/);assert.match(lead,/Terms/);
});

test('no shared administrative password, public lead deletion, or public PII listing remains',()=>{
 const route=fsread('app/api/public/business-registrations/route.js');
 const admin=fsread('components/admin-business-registrations.js');
 assert.doesNotMatch(route,/DEFAULT_ADMIN_PASSWORD|x-registrations-password|requireRegistrationsPassword|export async function DELETE/);
 assert.doesNotMatch(admin,/sessionStorage|passwordInput|x-registrations-password/);
 assert.match(route,/await authenticateRequest\(request\)/);
 assert.match(route,/requirePlatformPermission\(actor,/);
 assert.match(route,/db\.runTransaction/);
 assert.match(route,/auditLogs/);
 assert.match(route,/contactConsent/);
 assert.match(route,/await verifyAppCheckRequest\(request\)/);
 assert.match(route,/enforceRateLimit/);
 assert.match(route,/\[A-Za-z0-9\]\{16,40\}/); // legacy auto-ID updates remain possible
 assert.match(fsread('app/business/registrations/page.js'),/admin\.spotlyafrica\.com/);
});

test('public lead flow is separate from business approval and cannot grant ownership',()=>{
 const route=fsread('app/api/public/business-registrations/route.js');
 assert.match(route,/db\.collection\("businessRegistrations"\)/);
 assert.doesNotMatch(route,/tx\.(create|update)\(.*(?:memberships|businesses|ownerIds)/);
 assert.match(route,/linkedClaimId:null/);
 assert.match(route,/status:"new"/);
});

test('Driver error experience classifies verified territory and service problems without weakening guards',()=>{
 const state=fs.readFileSync(new URL('../../../driver/spotlydriver/spotlydriver/Core/Services/DriverAppState.swift',import.meta.url),'utf8');
 const home=fs.readFileSync(new URL('../../../driver/spotlydriver/spotlydriver/Features/Home/DriverHomeView.swift',import.meta.url),'utf8');
 const jobs=fs.readFileSync(new URL('../../../driver/spotlydriver/spotlydriver/Features/Jobs/JobsView.swift',import.meta.url),'utf8');
 assert.match(state,/readinessDisplayTitle/);assert.match(state,/Operating area needs confirmation/);
 assert.match(state,/serviceAvailabilityVerified = false/);assert.match(state,/connection = \.degraded/);
 assert.match(state,/DriverRuntimeServicePolicy\.mayGoOnline\(connection: connection/);
 assert.match(home,/readinessDisplayTitle/);assert.match(jobs,/readinessDisplayDetail/);
 assert.doesNotMatch(home,/Reconnecting to Spotly/);
});

test('Business portfolio callable errors are contextual and never silently treated as empty',()=>{
 const api=fs.readFileSync(new URL('../../../business/spotlybusiness/spotlybusiness/Production/FirebaseFunctionsService.swift',import.meta.url),'utf8');
 const hub=fs.readFileSync(new URL('../../../business/spotlybusiness/spotlybusiness/Features/Account/BusinessAccountHubView.swift',import.meta.url),'utf8');
 assert.match(api,/request\.operation == "businessPortfolio"/);assert.match(api,/SB-PORTFOLIO/);
 assert.match(api,/Functions\.functions\(region: "us-central1"\)/);
 assert.match(hub,/businesses could not load|businesses could not be loaded|couldn't confirm your businesses/i);
 assert.match(hub,/Get help/);assert.match(hub,/Try again/);
});
