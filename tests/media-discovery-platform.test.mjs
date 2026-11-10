import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mediaContract from '../contracts/spotly-media-discovery.v1.json' with { type: 'json' };
import projection from '../lib/generated/public-discovery-projection.js';
import { queryDiscoveryProjection } from '../lib/discovery-projection.js';

const read=(rel)=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8');
const exists=(rel)=>fs.existsSync(new URL(`../${rel}`,import.meta.url));

test('approved media contract owns responsive marketplace photography',()=>{
  assert.equal(mediaContract.version,'1.0.0');
  assert.deepEqual(mediaContract.responsiveWidths,[320,768,1536]);
  assert.match(mediaContract.canonicalPath,/marketplace\/photography/);
  assert.ok(Object.keys(mediaContract.families).length>80);
});

test('public discovery projection is precomputed and carries canonical media/category identity',()=>{
  assert.ok(projection.businesses.length>=2100);
  assert.ok(projection.products.length>=100);
  for(const row of projection.businesses.slice(0,200)){
    assert.ok(row.id&&row.name&&row.service&&row.vertical&&row.displayCategory);
    assert.match(row.media.image,/^https:\/\/(?:spotlyafrica\.com|firebasestorage\.googleapis\.com)\//);
    assert.doesNotMatch(row.media.image,/\/marketplace\/editorial\//);
  }
});

test('legacy marketplace prototype images are removed from the web bundle',()=>{
  assert.equal(exists('public/marketplace/editorial/eat.webp'),false);
  assert.equal(exists('public/marketplace/editorial/groceries.webp'),false);
  assert.equal(exists('public/marketplace/editorial/shop.webp'),false);
});

test('web Search and service feeds consume the shared discovery projection',()=>{
  for(const file of ['app/api/public/search/route.js','app/api/public/service-feed/route.js']){
    const source=read(file); assert.match(source,/projectedDiscoveryBusinesses/); assert.doesNotMatch(source,/queryOpenPlaces\(/);
  }
});

test('Firebase exposes discovery directly without routing through the website API',()=>{
  const source=read('firebase/functions/src/index.js');
  assert.match(source,/export const customerDiscovery/);
  assert.match(source,/queryDiscoveryProjection/);
  assert.doesNotMatch(read('firebase/functions/src/core/discovery-projection.js'),/fetch\(|spotlyafrica\.com\/api/);
});

test('discovery search and feed use the same projected business media',()=>{
  const feed=queryDiscoveryProjection({mode:'feed',country:'ZW',city:'Harare',service:'eat',limit:8});
  assert.equal(feed.ok,true); assert.ok(feed.businesses.length>0);
  const target=feed.businesses[0];
  const search=queryDiscoveryProjection({mode:'search',country:'ZW',city:'Harare',q:target.name,limit:8});
  const match=search.results.find(row=>row.entityId===target.id);
  assert.ok(match); assert.equal(match.image,target.coverImage);
});

test('customer iOS source is wired for callable discovery and approved remote media when provided',()=>{
  const root=process.env.SPOTLY_CUSTOMER_IOS_ROOT; if(!root)return;
  const marketplace=fs.readFileSync(path.join(root,'spotly/Core/Stores/MarketplaceStore.swift'),'utf8');
  const service=fs.readFileSync(path.join(root,'spotly/Features/Production/ServiceDiscoveryView.swift'),'utf8');
  const images=fs.readFileSync(path.join(root,'spotly/Core/Components/SpotlyImageView.swift'),'utf8');
  assert.match(marketplace,/FirebasePlatform\.discoverySearch/); assert.match(marketplace,/FirebasePlatform\.discoveryFeed/);
  assert.doesNotMatch(`${marketplace}\n${service}`,/\/api\/public\/(?:search|service-feed|marketplace\/business)/);
  assert.match(images,/SpotlyMediaCatalog\.approvedURL/); assert.doesNotMatch(images,/SpotlySampleImages|spotly_sample_/);
  assert.equal(fs.existsSync(path.join(root,'spotly/Assets.xcassets/SpotlySampleImages')),false);
});
