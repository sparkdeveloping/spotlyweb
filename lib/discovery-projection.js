import projection, { SPOTLY_MEDIA_DISCOVERY_SHA256, SPOTLY_MEDIA_DISCOVERY_VERSION } from './generated/public-discovery-projection.js';

const text = (value='') => String(value || '').trim();
const lower = (value='') => text(value).toLowerCase();
const terms = (value='') => lower(value).replace(/[^a-z0-9\s-]/g,' ').split(/\s+/).filter(part=>part.length>=2).slice(0,8);
const clamp = (value,min,max,fallback) => Math.min(max,Math.max(min,Number.isFinite(Number(value))?Math.floor(Number(value)):fallback));
function businessPublic(row={}) {
  return { id:row.id,name:row.name,brandName:row.brandName||undefined,category:row.displayCategory,categories:row.categories,city:row.city,country:row.country,area:row.area,address:row.address,businessType:row.businessType,coverImage:row.media?.image,image:row.media?.image,commerceVerified:row.commerceVerified,verificationStatus:row.verificationStatus,latitude:row.latitude,longitude:row.longitude,transactional:row.transactional,discovery:{service:row.service,vertical:row.vertical,displayCategory:row.displayCategory,mediaFamily:row.media?.family,mediaKind:row.media?.kind} };
}
function searchBusiness(row={}) { return { id:row.id,type:'business',entityId:row.id,businessId:row.id,title:row.name,name:row.name,subtitle:[row.displayCategory,row.area||row.city].filter(Boolean).join(' · '),description:'',displayCategory:row.displayCategory,category:row.displayCategory,vertical:row.vertical,image:row.media?.image,city:row.city,country:row.country,area:row.area,address:row.address,commerceVerified:row.commerceVerified,business:businessPublic(row) }; }
function searchProduct(row={},country='',city='') { return { id:row.id,type:'product',entityId:row.id,title:row.name,name:row.name,subtitle:[row.brand,row.categoryPath?.at(-1)].filter(Boolean).join(' · '),displayCategory:row.categoryPath?.at(-1)||'Product',category:row.categoryPath?.at(-1)||'',vertical:'product',image:row.image||'',country,city,catalogReference:true }; }
function matches(row, queryTerms) { return !queryTerms.length || queryTerms.every(term=>String(row.searchText||'').includes(term)); }
export function projectedDiscoveryBusinesses({country='',city='',service='',q='',category=''}={}) {
  const c=text(country).toUpperCase(), locality=lower(city), svc=lower(service), cat=lower(category), queryTerms=terms(q);
  return projection.businesses.filter(row=>(!c||row.country===c)&&(!locality||!row.city||lower(row.city)===locality)&&(!svc||row.service===svc)&&(!cat||cat==='all'||lower(row.vertical)===cat||lower(row.displayCategory)===cat)&&matches(row,queryTerms)).map(businessPublic);
}
export function queryDiscoveryProjection({ mode='search', country='', city='', service='', q='', category='', type='', businessId='', offset=0, limit=24 }={}) {
  const c=text(country).toUpperCase(), locality=lower(city), svc=lower(service), cat=lower(category), queryTerms=terms(q), start=Math.max(0,Number(offset)||0), size=clamp(limit,1,48,24);
  if (mode === 'business') { const row=projection.businesses.find(item=>item.id===text(businessId)); return row ? {ok:true,business:businessPublic(row),branches:[],products:[],transactional:false,claimAvailable:true,version:SPOTLY_MEDIA_DISCOVERY_VERSION,sha256:SPOTLY_MEDIA_DISCOVERY_SHA256} : {ok:false,notFound:true}; }
  let businesses=projection.businesses.filter(row=>(!c||row.country===c)&&(!locality||!row.city||lower(row.city)===locality)&&(!svc||row.service===svc)&&(!cat||cat==='all'||lower(row.vertical)===cat||lower(row.displayCategory)===cat)&&matches(row,queryTerms));
  if (mode === 'feed') {
    const categories=[...new Map(businesses.map(row=>[row.vertical,{key:row.vertical,label:row.displayCategory}])).values()].sort((a,b)=>a.label.localeCompare(b.label,'en',{sensitivity:'base'}));
    const page=businesses.slice(start,start+size).map(businessPublic);
    return { ok:true,version:SPOTLY_MEDIA_DISCOVERY_VERSION,sha256:SPOTLY_MEDIA_DISCOVERY_SHA256,service:svc,country:c,city:text(city),query:text(q),businesses:page,items:[],categories:categories.map(item=>item.label),businessCategories:categories,totalBusinesses:businesses.length,totalItems:0,nextOffset:start+page.length<businesses.length?start+page.length:null };
  }
  const businessResults=(!type||type==='all'||type==='business')?businesses.map(searchBusiness):[];
  const productRows=(!type||type==='all'||type==='product')&&(!svc||svc==='shop')?projection.products.filter(row=>matches(row,queryTerms)).map(row=>searchProduct(row,c,text(city))):[];
  const results=[...businessResults,...productRows].sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),'en',{sensitivity:'base'}));
  const page=results.slice(start,start+size);
  return { ok:true,version:SPOTLY_MEDIA_DISCOVERY_VERSION,sha256:SPOTLY_MEDIA_DISCOVERY_SHA256,results:page,total:results.length,nextOffset:start+page.length<results.length?start+page.length:null };
}
export const discoveryProjectionMetadata = Object.freeze({version:SPOTLY_MEDIA_DISCOVERY_VERSION,sha256:SPOTLY_MEDIA_DISCOVERY_SHA256,businesses:projection.businesses.length,products:projection.products.length});
