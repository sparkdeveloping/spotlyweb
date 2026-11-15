import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { deletionContext } from '../lib/account-deletion-context.js';

const web = resolve(import.meta.dirname, '..');
const business = resolve(web, '../../business/spotlybusiness/spotlybusiness');
const native = (path) => existsSync(resolve(business, path)) ? readFileSync(resolve(business, path), 'utf8') : '';
const source = (path) => readFileSync(resolve(web, path), 'utf8');

function mockFirestore({ memberships = [], owned = [], rides = [], orders = [], parcels = [], shopping = [], bookings = [] } = {}) {
  const counts = [];
  const docs = (items) => ({ empty: items.length === 0, docs: items.map((data) => ({ data: () => data })) });
  const mapping = { memberships, businesses: owned, rideTrips: rides, orders, parcelJobs: parcels, independentShoppingRequests: shopping, assistedBookings: bookings };
  const db = { collection(name) {
    return {
      where(field, op, value) {
        counts.push([name, field, op, value]);
        return { limit(n) { assert(n <= 250); return { get: async () => docs(mapping[name] || []) }; } };
      },
      doc() { return { get: async () => ({ exists: false }) }; }
    };
  } };
  return { db, counts };
}

test('merchant ownership holds account deletion without scanning entire portfolio', async () => {
  const { db, counts } = mockFirestore({ owned: [{ ownerIds: ['owner1'] }] });
  const { blockers } = await deletionContext(db, 'owner1');
  assert.equal(blockers.businessAccessReviewRequired, true);
  assert.equal(blockers.total, 0);
  assert.equal(counts.filter(([name]) => name === 'businesses').length, 1);
});
test('membership holds deletion, including a staff-only business account', async () => {
  const { db } = mockFirestore({ memberships: [{ userId: 'staff1', businessId: 'b2' }] });
  assert.equal((await deletionContext(db, 'staff1')).blockers.businessAccessReviewRequired, true);
});
test('customer active operations remain counted and linked order shells are not double counted', async () => {
  const { db } = mockFirestore({ rides: [{ state: 'matching' }], orders: [{ status: 'submitted', transactionType: 'ride' }, { status: 'accepted', transactionType: 'bite' }] });
  const { blockers } = await deletionContext(db, 'user1');
  assert.equal(blockers.total, 2);
  assert.equal(blockers.businessAccessReviewRequired, false);
});
test('completed customer operations do not create false deletion blockers', async () => {
  const { db } = mockFirestore({ rides: [{ state: 'completed' }], parcels: [{ state: 'delivered' }], orders: [{ status: 'refunded' }] });
  assert.equal((await deletionContext(db, 'user1')).blockers.total, 0);
});
test('Business Privacy has an account deletion action opening the verified web flow', () => {
  assert.match(native('Features/Profile/PrivacyAccessView.swift'), /spotlyafrica\.com\/account\?delete=1/);
  assert.match(source('components/account-app.js'), /setDeletionOpen\(true\)/);
  assert.match(source('app/api/customer/account/deletion/route.js'), /accountDeletionRequests/);
});
test('Business Activity has no dead customer call or reschedule menu actions', () => {
  const ui = native('Features/Activity/ActivityView.swift');
  assert.ok(ui.includes('Button("Call customer")'));
  assert.doesNotMatch(ui, /Button\("Contact customer"\)\s*\{\s*\}/);
  assert.doesNotMatch(ui, /Button\("Reschedule"\)\s*\{\s*\}/);
  assert.match(ui, /Verify handoff/);
  assert.match(ui, /appState\.can\(\.updateOrders\)/);
});
test('unsupported production rescheduling is not advertised as a working save', () => {
  const ui = native('Features/Activity/BookingDetailView.swift');
  assert.match(ui, /Request a change/);
  assert.match(ui, /configuration\.environment != \.production/);
  assert.match(native('App/BusinessAppState.swift'), /Rescheduling is not enabled/);
});
test('final navigation destinations enforce server-derived business role permissions', () => {
  assert.match(native('App/BusinessRouteDestination.swift'), /route\.requiredPermission\(in: appState\.experience\)/);
  assert.match(native('App/BusinessRouteDestination.swift'), /!appState\.can\(permission\)/);
});
test('support callback from previous business session cannot replace new session conversations', () => {
  const store = native('Production/BusinessSupportStore.swift');
  assert.match(store, /self\.observationGeneration == generation/);
  assert.match(store, /self\.observingUserID == userID/);
});
test('business app does not label the Release build as a TestFlight candidate or show legacy domain', () => {
  assert.doesNotMatch(native('Features/Profile/ProfileView.swift'), /TestFlight RC/);
  assert.doesNotMatch(native('Features/Profile/SupportView.swift'), /spotly\.co\.zw/);
});
test('Business callable backend remains explicitly separate and unmodified', () => {
  const index = readFileSync(resolve(web, '../../business/spotlybusiness/Backend/functions/index.js'), 'utf8');
  assert.match(index, /export const businessPortfolio = callable/);
  assert.match(index, /export const supportConversations = callable/);
});

test('Business order issue action always leads to real support, never an empty submission', () => {
  const ui = native('Features/Activity/OrderDetailView.swift');
  assert.match(ui, /Get help with this order/);
  assert.match(ui, /appState\.route\(to: \.support\)/);
  assert.doesNotMatch(ui, /IssueReportSheet\s*\{\s*_\s+in\s*\}/);
  assert.doesNotMatch(ui, /Recorded locally/);
});
