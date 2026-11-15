import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const exists=(path)=>existsSync(new URL('../'+path,import.meta.url));

test('Customer order creation has authenticated idempotency; Business fulfilment remains server-owned',()=>{
  const order=read('app/api/orders/create/route.js');
  const business=read('app/api/business-orders/update/route.js');
  assert.match(order,/authenticateRequest\(request\)/);
  assert.match(order,/orderRequests/);
  assert.match(order,/checkoutId/);
  assert.match(business,/authenticateRequest\(request\)/);
  assert.match(business,/requireBusinessPermission|requireBusinessAccess|businessId/);
});
test('Ride and Send remain tied to verified road access and caller-owned idempotency',()=>{
  for(const path of ['app/api/customer/rides/route.js','app/api/customer/parcels/route.js']){
    const src=read(path);
    assert.match(src,/authenticateRequest\(request\)/);
    assert.match(src,/mobilityRequestReferences/);
    assert.match(src,/roadAccessConsent/);
  }
});
test('Driver live jobs retain authenticated owner checks and separate live endpoint',()=>{
  const live=read('app/api/driver/live/route.js');
  const bootstrap=read('app/api/driver/bootstrap/route.js');
  assert.match(live,/authenticateRequest/);
  assert.match(live,/driver/);
  assert.match(bootstrap,/authenticateRequest/);
});
test('Support requests remain owner-private with staff-only internal messages',()=>{
  const support=read('app/api/support/conversations/route.js');
  assert.match(support,/conversation\.requesterId === user\.uid/);
  assert.match(support,/message\.raw\.internal !== true/);
  assert.match(support,/support\.respond/);
});
test('Commercial agreements require owner acceptance and append-only audit history',()=>{
  const contract=read('app/api/business/commercial-terms/route.js');
  assert.match(contract,/Only a verified business owner can accept/);
  assert.match(contract,/proposal\.fingerprint !== input\.fingerprint/);
  assert.match(contract,/historyRef/);
  assert.match(contract,/SPOTLY_COMMERCIAL_PRICING_ENABLED/);
});
test('Public AI guidance cannot mutate account, payment, or dispatch through a tool',()=>{
  const ai=read('app/api/support/assistant/route.js');
  assert.match(ai,/App Check|verifyAppCheckRequest|requireAppCheck/);
  assert.match(ai,/rateLimit|enforceRateLimit/);
  assert.doesNotMatch(ai,/createRefund\(|confirmPayment\(|acceptOffer\(/);
});
test('Offline selected coordinates do not silently enable booking or persist remotely',()=>{
  const saved=read('lib/saved-mobility-places.mjs');
  assert.doesNotMatch(saved,/getFirestore\(|fetch\(|httpsCallable\(/);
  assert.match(read('app/api/customer/rides/route.js'),/quote|roadAccessConsent/);
  assert.match(read('app/api/customer/parcels/route.js'),/quote|roadAccessConsent/);
});
test('Public demo editorial artwork cannot ship as marketplace photography',()=>{
  for(const name of ['eat.webp','groceries.webp','shop.webp'])assert.equal(exists('public/marketplace/editorial/'+name),false);
});
test('No source-level release gate can approve deployment without a human',()=>{
  const gate=read('scripts/lx12-launch-gate.mjs');
  assert.match(gate,/decision: 'NO_GO'/);
  assert.match(gate,/READY_FOR_MANUAL_REVIEW/);
  assert.doesNotMatch(gate,/deploy --prod|vercel promote|firebase deploy/);
});
