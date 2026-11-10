import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import places from '../lib/generated/open-marketplace-places.js';
import products from '../lib/generated/open-marketplace-products.js';
import { SPOTLY_MENU_BUSINESSES } from '../data/spotly-restaurant-menus.js';
import { BUSINESS_PHOTO_FAMILIES, businessPhotoFamily } from '../lib/business-photography.js';
import { marketplaceProfile } from '../lib/marketplace-taxonomy.js';
import { enrichMarketplaceProduct } from '../lib/marketplace-product-taxonomy.js';

const root = process.cwd();
const ORIGIN = 'https://spotlyafrica.com';
const WIDTHS = [320, 768, 1536];
const clean = (value='') => String(value || '').trim();
const lower = (value='') => clean(value).toLowerCase();
const unique = (values=[]) => [...new Set(values.filter(Boolean))];
const absoluteMedia = (family, width=768) => `${ORIGIN}/marketplace/photography/${family}-${width}.webp`;
const approvedMerchantImage = (record={}) => {
  const value = clean(record.coverImage || record.image || record.imageUrl || record.photoUrl || record.media?.cover || record.media?.hero);
  if (!value || /\/marketplace\/(?:editorial|editorial-pack|photography)\//i.test(value) || /\.(?:svg|gif)(?:[?#]|$)/i.test(value) || /(?:^|\/)(?:logos?|avatars?|icons?)(?:\/|[._-])/i.test(value)) return '';
  const provenance = record.imageProvenance || {};
  const source = record.source || {};
  if (value === record.logoUrl || value === record.logo || source.type === 'themenu_partner' || /themenu\.co\.zw/i.test(value)) return '';
  if ((Number(provenance.width) > 0 && Number(provenance.width) < 640) || (Number(provenance.height) > 0 && Number(provenance.height) < 360)) return '';
  const directory = ['openstreetmap','spotly_assist_research','themenu_partner'].includes(source.type);
  const claimed = record.claimed === true || record.claimStatus === 'claimed';
  const approved = provenance.approved === true && provenance.businessId === record.id && ['merchant_owned','licensed'].includes(provenance.rightsStatus);
  const hosted = value.startsWith('https://firebasestorage.googleapis.com/') && (!directory || claimed);
  const owned = source.rightsStatus === 'merchant_owned' && source.type !== 'themenu_partner';
  return hosted || approved || owned ? value : '';
};
function businessRow(record={}) {
  const profile = marketplaceProfile(record);
  const mediaFamily = businessPhotoFamily(record);
  const merchantImage = approvedMerchantImage(record);
  const image = merchantImage || absoluteMedia(mediaFamily);
  const country = clean(record.country).toUpperCase();
  const city = clean(record.city);
  const area = clean(record.area || record.suburb);
  const categories = unique([record.category, ...(Array.isArray(record.categories) ? record.categories : [])]).slice(0, 8);
  return {
    id: clean(record.id), name: clean(record.name || record.brandName || 'Spotly place'), brandName: clean(record.brandName),
    country, city, area, address: clean(record.address), service: profile.service, vertical: profile.vertical,
    displayCategory: clean(profile.displayCategory || record.category || 'Business'), businessType: clean(record.businessType), categories,
    media: { image, family: mediaFamily, kind: merchantImage ? 'merchant' : 'editorial', src320: merchantImage || absoluteMedia(mediaFamily,320), src768: image, src1536: merchantImage || absoluteMedia(mediaFamily,1536) },
    commerceVerified: profile.commerceVerified === true, transactional: record.transactional === true || profile.commerceVerified === true,
    verificationStatus: clean(record.verificationStatus), latitude: Number.isFinite(Number(record.latitude ?? record.coordinates?.lat)) ? Number(record.latitude ?? record.coordinates?.lat) : null,
    longitude: Number.isFinite(Number(record.longitude ?? record.coordinates?.lng)) ? Number(record.longitude ?? record.coordinates?.lng) : null,
    searchText: unique([record.name,record.brandName,record.category,...categories,record.businessType,city,area,record.address,...(record.tags||[]),...(record.searchTerms||[]),...(record.aliases||[])]).join(' ').toLowerCase()
  };
}
function productRow(record={}) {
  const item = enrichMarketplaceProduct(record);
  const name = clean(item.canonicalName || item.name || item.title || 'Item');
  const categoryPath = Array.isArray(item.categoryPath) ? item.categoryPath.map(clean).filter(Boolean).slice(0,5) : [];
  return { id: clean(item.id || item.entityId), type: 'product', name, brand: clean(item.brand), categoryPath, image: clean(item.image || item.imageUrl), searchText: unique([name,item.brand,item.packSize,item.variant,...categoryPath,...(item.searchTerms||[])]).join(' ').toLowerCase() };
}
const seen = new Map();
for (const raw of [...(places.records || []), ...SPOTLY_MENU_BUSINESSES]) {
  const row = businessRow(raw); if (!row.id) continue;
  const prior = seen.get(row.id); if (!prior || (row.media.kind === 'merchant' && prior.media.kind !== 'merchant')) seen.set(row.id,row);
}
const businesses = [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}) || a.id.localeCompare(b.id));
const projection = { version:'1.0.0', generatedAt:'2026-11-09', businesses, products:(products.records||[]).filter(item=>!item.ageRestricted).map(productRow).filter(item=>item.id).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'})) };
const mediaContract = { version:'1.0.0', origin:ORIGIN, responsiveWidths:WIDTHS, canonicalPath:'/marketplace/photography/{family}-{width}.webp', forbiddenPrototypePrefixes:['/marketplace/editorial/','/marketplace/editorial-pack/'], discovery:{version:'1.0.0', callable:'customerDiscovery', maxPageSize:48, services:['eat','shop','book','events']}, families:BUSINESS_PHOTO_FAMILIES };
const json = JSON.stringify(mediaContract,null,2)+'\n';
const hash = crypto.createHash('sha256').update(json).digest('hex');
const moduleText = `// Generated by scripts/generate-media-discovery.mjs. Do not hand-edit.\nexport const SPOTLY_MEDIA_DISCOVERY_VERSION = ${JSON.stringify(mediaContract.version)};\nexport const SPOTLY_MEDIA_DISCOVERY_SHA256 = ${JSON.stringify(hash)};\nexport default ${JSON.stringify(projection)};\n`;
for (const rel of ['contracts/spotly-media-discovery.v1.json','firebase/functions/src/contracts/spotly-media-discovery.v1.json']) { fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true}); fs.writeFileSync(path.join(root,rel),json); }
for (const rel of ['lib/generated/public-discovery-projection.js','firebase/functions/src/generated/public-discovery-projection.js']) { fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true}); fs.writeFileSync(path.join(root,rel),moduleText); }
console.log(`Spotly media/discovery generated: businesses=${businesses.length} products=${projection.products.length} sha256=${hash}`);
