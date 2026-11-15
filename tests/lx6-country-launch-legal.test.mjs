import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countryLaunchReadiness, LX6_COUNTRIES, LX6_SERVICES } from '../lib/lx6-country-launch-readiness.mjs';
import { driverConsentSnapshot, PILOT_POLICY } from '../lib/lx6-policy-snapshot.mjs';

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const now = Date.parse('2026-11-15T12:00:00Z');
const evidence = {status:'approved',reviewedBy:'reviewer-123',evidenceRef:'approved/review-123',reviewedAt:'2026-11-14T12:00:00Z'};
const all = () => Object.fromEntries(['privacyReview','legalEntity','supportResponse','financialSettlement','transportAuthorityReview','driverVehicleVerification','safetyResponse','deliveryAuthorityReview','merchantAgreement','merchantVerification'].map(k=>[k,{...evidence}]));

test('all six country/service pairs fail closed without evidence', () => {
  assert.equal(LX6_COUNTRIES.length * LX6_SERVICES.length, 6);
  for (const country of LX6_COUNTRIES) for (const service of LX6_SERVICES) {
    const result = countryLaunchReadiness({},country,service,now);
    assert.equal(result.ready,false); assert.ok(result.blockers.length>=6);
  }
});
test('unsupported country/service never inherits approval', () => {
  assert.equal(countryLaunchReadiness({},'US','ride',now).ready,false);
  assert.equal(countryLaunchReadiness({},'ZW','payment',now).ready,false);
});
test('approval requires a human, reference and valid review timestamp', () => {
  for (const field of ['reviewedBy','evidenceRef','reviewedAt']) {
    const entry={...evidence}; delete entry[field];
    assert.equal(countryLaunchReadiness({launchCompliance:{ZW:{ride:{...all(),legalEntity:entry}}}},'ZW','ride',now).ready,false);
  }
});
test('future and expired approval blocked', () => {
  const template=all(); template.privacyReview={...evidence, expiresAt:'2026-11-15T11:00:00Z'};
  assert.equal(countryLaunchReadiness({launchCompliance:{ZW:{ride:template}}},'ZW','ride',now).ready,false);
  template.privacyReview={...evidence, reviewedAt:'2026-11-16T00:00:00Z'};
  assert.equal(countryLaunchReadiness({launchCompliance:{ZW:{ride:template}}},'ZW','ride',now).ready,false);
});
test('country and service evidence is isolated', () => {
  const config={launchCompliance:{ZW:{ride:all()}}};
  assert.equal(countryLaunchReadiness(config,'ZW','ride',now).ready,true);
  assert.equal(countryLaunchReadiness(config,'MW','ride',now).ready,false);
  assert.equal(countryLaunchReadiness(config,'ZW','business',now).ready,false);
  assert.equal(countryLaunchReadiness(config,'ZW','send',now).ready,false);
});
test('missing transport or safety clearance blocks ride, not valid business scope', () => {
  const config={launchCompliance:{MW:{business:all(),ride:all()}}};
  delete config.launchCompliance.MW.ride.safetyResponse;
  assert.equal(countryLaunchReadiness(config,'MW','business',now).ready,true);
  assert.equal(countryLaunchReadiness(config,'MW','ride',now).ready,false);
});
test('consent evidence rejects false and missing acceptance', () => {
  for (const patch of [{agreementsAccepted:false},{locationConsent:false},{country:'US'}]) {
    assert.throws(()=>driverConsentSnapshot({agreementsAccepted:true,locationConsent:true,country:'MW',...patch}));
  }
});
test('consent evidence describes published pilot notices, not fictional driver agreement', () => {
  const saved=driverConsentSnapshot({agreementsAccepted:true,locationConsent:true,country:'ZW'});
  assert.equal(saved.termsVersion,PILOT_POLICY.terms.version);
  assert.equal(saved.privacyVersion,PILOT_POLICY.privacy.version);
  assert.equal(saved.driverSpecificAgreement,'not_yet_verified');
  assert.equal(saved.scope,'published_pilot_notices');
});
test('web driver submit records consent within existing submission write', () => {
  const src=read('../app/api/driver/application/route.js');
  assert.match(src,/driverConsentSnapshot\(/); assert.match(src,/consentEvidence:\s*\{/);
  assert.match(src,/actorId:\s*user\.uid/);
});
test('native driver callable checks acceptance and stores immutable version strings', () => {
  const src=read('../firebase/functions/src/core/driver-runtime.js');
  assert.match(src,/application\.agreementsAccepted !== true \|\| application\.locationConsent !== true/);
  assert.match(src,/termsVersion: "2026-08-18"/);
  assert.match(src,/driverSpecificAgreement: "not_yet_verified"/);
});
test('business registration has browsable terms and privacy URLs', () => {
  const src=read('../../../business/spotlybusiness/spotlybusiness/Features/Entry/EntryFlowView.swift');
  assert.match(src,/Link\("Read terms"/); assert.match(src,/Link\("Privacy notice"/);
});
test('mobility launch enforcement is off unless explicitly enabled', () => {
  const src=read('../app/api/admin/service-launch/route.js');
  assert.match(src,/SPOTLY_LX6_ENFORCE_COUNTRY_LAUNCH_GATE==="true"/);
  assert.match(src,/data\.action==="enable"/);
  assert.match(src,/countryLaunchReadiness\(current,country,data\.service\)/);
});
test('readiness endpoint includes country checks without extra database queries', () => {
  const src=read('../app/api/admin/launch-readiness/route.js');
  assert.match(src,/countryComplianceChecks/); assert.match(src,/countryCompliance,/);
  assert.match(src,/doc\("global"\)/);
});
test('active country with missing legal evidence is marked blocked for admin release', () => {
  const src=read('../app/api/admin/launch-readiness/route.js');
  assert.match(src,/rideLiveScopes : sendLiveScopes/);
  assert.match(src,/\? "blocked" : "needs_verification"/);
});
