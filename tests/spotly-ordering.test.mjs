import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import places from '../lib/generated/open-marketplace-places.js';
import { groupMarketplaceBusinesses, businessGroupKey } from '../lib/business-groups.js';
import { directoryShoppingEligible, directoryIntakeStore } from '../lib/spotly-catalogue.js';
import { independentPublicStore, independentQuote } from '../lib/independent-shopping.js';
import { independentStoreSafe, independentStoreRequestSafe } from '../lib/assist-store-safety.js';
import { menuItemsForBusiness } from '../data/spotly-restaurant-menus.js';
import { routeHarness } from './helpers/route-harness.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const bon=places.records.find(item=>item.id==='osm-node-1574307183');

test('all directory chains are grouped without replacing their branch identities',()=>{
 const groups=groupMarketplaceBusinesses(places.records);
 assert.equal(new Set(groups.map(businessGroupKey)).size,groups.length);
 const local=groupMarketplaceBusinesses(places.records.filter(item=>item.city==='Harare'));
 for(const name of ['Bon Marché','Pick n Pay','Chicken Inn']){
  const matches=local.filter(item=>item.name===name);
  assert.equal(matches.length,1,name);assert.ok(matches[0].groupedLocations.length>1,name);
  assert.ok(matches[0].groupedLocations.every(location=>places.records.some(item=>item.id===location.id)));
 }
 const merchant={...bon,id:'owner-store',commerceVerified:true};
 const grouped=groupMarketplaceBusinesses([bon,merchant])[0];
 assert.ok(grouped.groupedLocations.some(item=>item.id==='owner-store'));
 assert.ok(grouped.groupedLocations.some(item=>item.id===bon.id));
});
test('every eligible food or retail location has an unpriced request catalogue',()=>{
 const eligible=places.records.filter(directoryShoppingEligible);assert.ok(eligible.length>800);
 for(const business of eligible){const raw=directoryIntakeStore(business.id,business),store=independentPublicStore(raw.id,raw);assert.ok(store?.items.length,business.name);assert.equal(raw.financeReady,false);assert.equal(raw.operationalReviewed,false);assert.ok(store.items.every(item=>item.priceEstimate===null));}
 assert.equal(directoryIntakeStore('paused',{...bon,assistAccepting:false}),null);
 assert.equal(directoryIntakeStore('owner',{...bon,ownerIds:['owner'],claimStatus:'claimed'}),null);
});
test('unknown totals remain null, custom selections stay bounded and verified menus retain dish names',()=>{
 const raw=directoryIntakeStore(bon.id,bon),store=independentPublicStore(raw.id,raw);
 const quote=independentQuote(store,[{itemId:store.items[0].id,quantity:2}],{customItems:[{name:'Specific cereal 500g',quantity:1}]});
 assert.equal(quote.totalEstimate,null);assert.equal(quote.merchandiseEstimate,null);assert.equal(quote.paymentRequired,false);assert.equal(quote.items.length,2);
 assert.throws(()=>independentQuote(store,[],{customItems:[{name:'X',quantity:1}]}));
 assert.throws(()=>independentQuote(store,[{itemId:'forged-price',quantity:1}],{}));
 const menu=menuItemsForBusiness({name:'Fishmonger',city:'Harare'});assert.equal(menu.length,8);assert.ok(menu.some(item=>item.name==='Garlic prawns'));assert.ok(menu.every(item=>item.priceEstimate===null));
 assert.deepEqual(menuItemsForBusiness({name:'Other restaurant',city:'Harare'}),[]);
 assert.equal(independentStoreRequestSafe(raw,bon),true);assert.equal(independentStoreSafe(raw,bon),false);
 assert.equal(independentStoreSafe({...raw,operationalReviewed:true,collectionAddressVerified:true,address:'Verified street, Harare'},bon),true);
});
test('real handlers materialize one branch basket, confirm quote, approve and initiate only one isolated payment',async()=>{
 const h=routeHarness(root);const settings={independentShopping:{requestEnabled:true},assistCoverage:{},verification:{publishUnclaimed:true}};
 h.records.set('platformSettings/global',settings);
 const intake=h.load('app/api/customer/independent-shopping/requests/route.js');
 const store=directoryIntakeStore(bon.id,bon);
 const body={requestId:'idempotent_request_123',storeId:store.id,items:[{itemId:store.items[0].id,quantity:2}],customItems:[{name:'Wholegrain cereal 500g',quantity:1}],contactName:'Test Customer',contactPhone:'+263770000000',deliveryAddress:'Test delivery street, Harare',notes:''};
 let response=await intake.POST(h.request(body));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const created=await response.json();assert.equal(created.estimate.totalEstimate,null);
 const repeat=await intake.POST(h.request(body));assert.equal((await repeat.json()).idempotent,true);assert.equal([...h.records.keys()].filter(key=>key.startsWith('independentShoppingRequests/')).length,1);
 assert.equal(h.records.get('independentShoppingRequests/'+created.id).assistService,'shop');
 assert.equal([...h.records.keys()].some(key=>key.startsWith('orders/')||key.startsWith('deliveryJobs/')),false);
 h.setActor({uid:'operator-one'});const quote=h.load('app/api/admin/assist-shopping/actions/route.js');
 const amounts={id:created.id,action:'offer_quote',merchandiseTotal:12,shoppingFee:2,deliveryFee:3,note:'Called branch and confirmed basket and fees'};
 response=await quote.POST(h.request(amounts));assert.equal(response.status,422);
 response=await quote.POST(h.request({...amounts,locationVerified:true,collectionAddress:'Confirmed collection street, Harare',financeReady:true}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const saved=h.records.get('independentShoppingRequests/'+created.id);assert.equal(saved.finalQuote.total,17);assert.equal(saved.collectionAddress,'Confirmed collection street, Harare');
 const respond=h.load('app/api/customer/independent-shopping/requests/respond/route.js');
 h.setActor({uid:'another-customer'});assert.equal((await respond.POST(h.request({id:created.id,decision:'accept_quote'}))).status,404);
 h.setActor({uid:'customer-one',email:'customer@example.com'});assert.equal((await respond.POST(h.request({id:created.id,decision:'accept_quote'}))).status,200);
 const pay=h.load('app/api/customer/independent-shopping/pay/route.js');
 assert.equal((await pay.POST(h.request({requestId:created.id,channel:'web'}))).status,503);assert.equal(h.counters.payments,0);
 settings.assistFinance={enabled:true,providerReviewed:true,driverDispatchEnabled:true,manualFloatAttestationEnabled:true};settings.independentShopping.paymentCollectionEnabled=true;
 response=await pay.POST(h.request({requestId:created.id,channel:'web'}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));assert.equal(h.counters.payments,1);
 assert.equal((await pay.POST(h.request({requestId:created.id,channel:'web'}))).status,200);assert.equal(h.counters.payments,1);
 assert.equal(h.records.get('independentShoppingRequests/'+created.id).dispatchStatus,'not_dispatched');
 // A later opt-out blocks new quote requests from this same deep-linked static ID.
 h.records.set('businesses/'+bon.id,{...bon,assistAccepting:false});
 assert.equal((await intake.POST(h.request({...body,requestId:'second_request_456'}))).status,409);
});
test('customer presentation has no external menu promotion or source photo credit',()=>{
 for(const path of ['components/service-experience.js','components/business-photo.js','data/spotly-restaurant-menus.js'])assert.doesNotMatch(readFileSync(new URL('../'+path,import.meta.url),'utf8'),/themenu|The Menu/);
});

test('pending ownership and regulated shop categories cannot be activated accidentally',()=>{
 for(const claimStatus of ['submitted','under_review','needs_information','approved','claim_pending']) assert.equal(directoryShoppingEligible({...bon,claimStatus,ownershipStatus:'unclaimed'}),false,claimStatus);
 assert.equal(directoryShoppingEligible({...bon,name:'Example Bottle Store',sourceTags:{shop:'alcohol'},ageRestricted:false}),false);
});
test('Firestore branches have distinct catalogues, baskets and authoritative branch opt-outs',async()=>{
 const h=routeHarness(root);h.records.set('platformSettings/global',{verification:{publishUnclaimed:true}});
 const business={...bon,id:'sample-market',name:'Sample Market'};h.records.set('businesses/sample-market',business);
 h.records.set('branches/north',{businessId:'sample-market',public:true,name:'North',city:'Harare',address:'North collection road, Harare'});
 h.records.set('branches/south',{businessId:'sample-market',public:true,name:'South',city:'Harare',address:'South collection road, Harare'});
 const {directoryShoppingStore}=h.load('lib/directory-shopping-server.js');
 const north=await directoryShoppingStore(h.db,{businessId:'sample-market',branchId:'north'}),south=await directoryShoppingStore(h.db,{businessId:'sample-market',branchId:'south'});
 assert.notEqual(north.store.id,south.store.id);assert.equal(north.store.directoryBranchId,'north');assert.equal(south.store.address,'South collection road, Harare');
 const intake=h.load('app/api/customer/independent-shopping/requests/route.js');
 const body={requestId:'branch_request_123',storeId:north.store.id,items:[{itemId:north.store.items[0].id,quantity:1}],contactName:'Test Person',contactPhone:'+263770000000',deliveryAddress:'Test delivery road, Harare'};
 const response=await intake.POST(h.request(body));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const data=await response.json();assert.equal(h.records.get('independentShoppingRequests/'+data.id).directoryBranchId,'north');
 h.records.get('branches/north').assistAccepting=false;
 assert.equal(await directoryShoppingStore(h.db,{storeId:north.store.id}),null);
 assert.ok(await directoryShoppingStore(h.db,{storeId:south.store.id}));
});
test('shopper assignment retains each accepted quote address when later quotes update the store',async()=>{
 const h=routeHarness(root),raw=directoryIntakeStore(bon.id,bon);
 h.records.set('platformSettings/global',{assistFinance:{driverDispatchEnabled:true}});
 h.records.set('independentShoppingStores/'+raw.id,{...raw,operationalReviewed:true,collectionAddressVerified:true,financeReady:true,address:'Address from a later customer quote'});
 h.setActor({uid:'assignment-operator',profile:{roles:['operations_manager']}});
 const assign=h.load('app/api/admin/assist-fulfillment/route.js');
 for(const [index,address] of ['First accepted collection road, Harare','Second accepted collection road, Harare'].entries()){
  const id='funded_request_'+index,driverId='shopper-'+index;
  h.records.set('independentShoppingRequests/'+id,{storeId:raw.id,storeName:raw.name,sourceBusinessId:bon.id,state:'funded_awaiting_shopper',paymentStatus:'paid_held',finalQuote:{merchandiseTotal:5,total:8,collectionAddress:address},items:[{itemId:'bread',name:'Bread',quantity:1}],deliveryAddress:'Test customer delivery road'});
  h.records.set('assistShopperFloatTransfers/'+id,{requestId:id,status:'externally_confirmed',currency:'USD',amount:5,verifiedBy:'finance-operator',externalReference:'test-float-'+index});
  h.records.set('drivers/'+driverId,{status:'active'});h.records.set('driverApplications/'+driverId,{status:'approved'});h.records.set('driverPresence/'+driverId,{online:true,enabledCapabilities:['shop_and_deliver']});
  const response=await assign.POST(h.request({action:'assign',requestId:id,driverId,note:'Assign vetted shopper to accepted quote'}));assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  assert.equal(h.records.get('assistIndependentShoppingJobs/'+id).storeAddress,address);
 }
});
