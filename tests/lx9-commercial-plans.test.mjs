import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commercialRule, commercialOffer, effectiveCommercialTerms, publicCommercialTrial } from '../lib/commercial-policies.mjs';
const root = resolve(import.meta.dirname, '..');
const source = (file) => readFileSync(resolve(root, file), 'utf8');
const NOW = Date.parse('2026-12-01T12:00:00.000Z');
const rule = (country, service, businessType, rate) => ({ country, service, businessType, commissionPercent: rate });
const configuration = (overrides = {}) => ({
  mode: 'active', revision: 4, agreementVersion: 'v4', agreementUrl: 'https://spotlyafrica.com/terms',
  rules: [rule('ZW','eat','*', 12), rule('MW','eat','*', 8), rule('ZW','eat','restaurant_food', 7), rule('ZW','shop','*', 15)],
  trial: { status: 'hidden', benefit: 'commission', durationMonths: 3, startsAt: '', endsAt: '', approvedAt: '', headline: '', termsUrl: '' },
  ...overrides
});
const context = { country: 'ZW', service: 'eat', businessType: 'restaurant_food', fallbackPercent: 10, now: NOW };
test('LX9: draft settings and missing agreement preserve existing commission', () => {
  const draft = commercialOffer({ config: configuration({ mode: 'draft' }), ...context });
  assert.equal(draft.enabled, false);
  assert.equal(effectiveCommercialTerms({ config: configuration(), ...context }).commissionPercent, 10);
});
test('LX9: category specificity, country isolation and service isolation', () => {
  assert.equal(commercialRule(configuration(), context, NOW).commissionPercent, 7);
  assert.equal(commercialRule(configuration(), { ...context, businessType: 'grocery_retail' }, NOW).commissionPercent, 12);
  assert.equal(commercialRule(configuration(), { ...context, country: 'MW' }, NOW).commissionPercent, 8);
  assert.equal(commercialRule(configuration(), { ...context, service: 'shop' }, NOW).commissionPercent, 15);
  assert.equal(commercialRule(configuration(), { ...context, country: 'US' }, NOW), null);
});
test('LX9: inactive and mismatched overrides never apply', () => {
  for (const status of ['draft', 'disabled']) {
    const offered = commercialOffer({ config: configuration(), ...context, override: { country: 'ZW', service: 'eat', status, commissionPercent: 2 } });
    assert.equal(offered.commissionPercent, 7);
  }
  assert.equal(commercialOffer({ config: configuration(), ...context, override: { country: 'MW', service: 'eat', status: 'active', revision: 1, commissionPercent: 2 } }).commissionPercent, 7);
});
test('LX9: active per-business override requires explicit matching consent', () => {
  const override = { country:'ZW', service:'eat', status:'active', revision:2, commissionPercent:3 };
  const proposal = commercialOffer({ config: configuration(), override, ...context });
  assert.equal(proposal.commissionPercent, 3);
  assert.equal(effectiveCommercialTerms({ config: configuration(), override, ...context }).commissionPercent, 10);
  assert.equal(effectiveCommercialTerms({ config: configuration(), override, ...context, agreement:{ fingerprint: proposal.fingerprint, country:'ZW', service:'eat', agreedCommissionPercent:3, acceptedAt:'2026-11-20T12:00:00Z', policyRevision:4 } }).commissionPercent, 3);
});
test('LX9: accepted commercial terms expire without affecting previous transactions', () => {
  const offer = commercialOffer({ config: configuration(), ...context });
  const agreement = { fingerprint:offer.fingerprint, country:'ZW', service:'eat', agreedCommissionPercent:7,
    acceptedAt:'2026-11-20T12:00:00Z', contractEndsAt:'2026-11-30T00:00:00Z' };
  assert.equal(effectiveCommercialTerms({ config: configuration(), agreement, ...context }).commissionPercent, 10);
});
test('LX9: revisions do not silently rewrite an existing accepted agreement', () => {
  const before = commercialOffer({ config: configuration(), ...context });
  const agreement = { fingerprint: before.fingerprint, country:'ZW', service:'eat', agreedCommissionPercent:7, acceptedAt:'2026-11-20T12:00:00Z', policyRevision:4 };
  const after = configuration({ revision: 5, rules:[rule('ZW','eat','restaurant_food', 23)] });
  const accepted = effectiveCommercialTerms({ config: after, agreement, ...context });
  assert.equal(accepted.source, 'prior_accepted_agreement');
  assert.equal(accepted.commissionPercent, 7);
});
test('LX9: agreement cannot be carried between country or service', () => {
  const agreement = { country:'MW', service:'eat', agreedCommissionPercent:1, acceptedAt:'2026-11-20T12:00:00Z' };
  assert.equal(effectiveCommercialTerms({ config: configuration(), agreement, ...context }).commissionPercent, 10);
});
test('LX9: public trial remains hidden without approval, active plan and valid enrollment dates', () => {
  const trial = { status:'live', benefit:'commission', durationMonths:3, startsAt:'2026-11-15T00:00:00Z', endsAt:'2026-12-15T00:00:00Z',
    approvedAt:'2026-11-14T12:00:00Z', approvalReference:'approval-2026-lx9', headline:'Three months without Spotly commission for eligible businesses', termsUrl:'https://spotlyafrica.com/offer-terms' };
  assert.equal(publicCommercialTrial(configuration({trial}), NOW)?.durationMonths, 3);
  assert.equal(publicCommercialTrial(configuration({trial:{...trial,approvedAt:''}}), NOW), null);
  assert.equal(publicCommercialTrial(configuration({trial:{...trial,status:'scheduled'}}), NOW), null);
  assert.equal(publicCommercialTrial(configuration({mode:'draft',trial}), NOW), null);
  assert.equal(publicCommercialTrial(configuration({trial}), Date.parse('2027-01-01T00:00:00Z')), null);
});
test('LX9: signed three-month commission benefit survives closure of enrollment window', () => {
  const proposal = commercialOffer({ config: configuration(), ...context });
  const agreement = { fingerprint:proposal.fingerprint, country:'ZW', service:'eat', agreedCommissionPercent:7,
    policyRevision:4, acceptedAt:'2026-11-20T12:00:00Z', trialEnrolledAt:'2026-11-20T12:00:00Z',
    trialBenefit:'commission', trialEndsAt:'2027-02-20T12:00:00Z' };
  assert.equal(effectiveCommercialTerms({ config:configuration(), agreement, ...context }).commissionPercent, 0);
  const later = effectiveCommercialTerms({config:configuration(), agreement, ...context, now:Date.parse('2027-02-21T12:00:00Z')});
  assert.equal(later.commissionPercent, 7);
  assert.equal(later.trialApplied, false);
});
test('LX9: no fabricated subscription charge or automatic MWK settlements', () => {
  assert.doesNotMatch(source('lib/commercial-policies.mjs'), /createSubscriptionInvoice|chargeSubscription/);
  assert.match(source('components/admin-commercial-plans.js'), /subscription billing has not been implemented/i);
  assert.match(source('app/api/business/money/route.js'), /moneyAccountId\(businessId, "USD"\)/);
  assert.doesNotMatch(source('app/api/business/money/route.js'), /moneyAccountId\(businessId, "MWK"\)/);
});
test('LX9: both transaction families snapshot the resolved commission only for new orders', () => {
  for (const route of ['app/api/orders/create/route.js','app/api/customer/transactions/create/route.js']) {
    const code = source(route);
    assert.match(code, /effectiveCommercialTerms\(/);
    assert.match(code, /SPOTLY_COMMERCIAL_PRICING_ENABLED/);
    assert.match(code, /commercialTerms\.commissionPercent/);
    assert.match(code, /policyRevision: commercialTerms\.policyRevision/);
  }
});
test('LX9: config and owner acceptance are server-owned with audit and concurrency safeguards', () => {
  const admin = source('app/api/admin/commercial-plans/route.js');
  assert.match(admin, /requireSpotlyStaffPermission/);
  assert.match(admin, /expectedRevision/);
  assert.match(admin, /auditLogs/);
  const owner = source('app/api/business/commercial-terms/route.js');
  assert.match(owner, /requireBusinessPermission/);
  assert.match(owner, /access\.platformAdmin/);
  assert.match(owner, /commercial_policy\.accepted/);
  assert.match(owner, /businessCommercialAgreementVersions/);
  assert.match(owner, /proposal\.fingerprint !== input\.fingerprint/);
});
test('LX9: offer remains invisible until both public release gates permit it', () => {
  assert.match(source('app/api/public/commercial-offer/route.js'), /SPOTLY_COMMERCIAL_OFFER_VISIBLE/);
  assert.match(source('components/business/business-marketing.js'), /NEXT_PUBLIC_SPOTLY_COMMERCIAL_OFFER_VISIBLE/);
  assert.match(source('components/business/business-marketing.js'), /offer &&/);
});
