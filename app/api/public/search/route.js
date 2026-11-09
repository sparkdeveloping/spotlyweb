import { groupMarketplaceBusinesses } from "@/lib/business-groups";
import { marketplaceMedia } from "@/lib/marketplace-editorial";
import { unclaimedPublicationEnabled } from "@/lib/directory-publication-server";
import { canShowDirectoryRecord } from "@/lib/nxt-policy";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { queryOpenPlaces, queryOpenProducts, mergeCuratedWithFirestore } from "@/lib/open-marketplace-data";
import { isMarketplaceDiscoverable, marketplaceTrust } from "@/lib/marketplace-trust";
import { publicBusinessRecord, publicCanonicalProduct, publicMerchantProduct } from "@/lib/marketplace-public";
import { marketplaceProfile, serviceMatchesMarketplaceBusiness } from "@/lib/marketplace-taxonomy";
import { marketplaceRank } from "@/lib/marketplace-ranking";
import { countryForCity, normalizeCountryCode } from "@/lib/country-engine";
import { requireServiceDiscoverable } from "@/lib/service-availability-server";
import { resolveServiceAvailability } from "@/lib/service-availability";

export const runtime = "nodejs";
const text=(value)=>String(value||"").trim().toLowerCase();
const words=(value)=>text(value).replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").split(" ").filter((part)=>part.length>=2).slice(0,8);

function businessSearchRecord(business){const profile=marketplaceProfile(business);return {...business,type:"business",entityId:business.id,title:business.name,subtitle:[profile.displayCategory,business.area||business.city].filter(Boolean).join(" · "),displayCategory:profile.displayCategory,vertical:profile.vertical,cardMode:profile.cardMode,image:marketplaceMedia(business).src,href:`/place/${encodeURIComponent(business.id)}`,searchText:[business.name,business.brandName,profile.displayCategory,business.category,...(business.categories||[]),business.city,business.area,business.address,...(business.tags||[]),...(business.searchTerms||[]),...(business.groupedLocations||[]).flatMap(location=>[location.name,location.branchName,location.address])].filter(Boolean).join(" ")};}
function branchRecord(doc,business){const item=doc.data()||{},city=item.city||business?.city||"",country=normalizeCountryCode(item.country||business?.country)||countryForCity(city)?.country?.code||"";return{id:doc.id,type:"place",entityId:doc.id,businessId:item.businessId||"",businessName:business?.name||"",title:item.branchName||item.name||item.displayName||business?.name||"Place",subtitle:[item.suburb||item.area,item.city].filter(Boolean).join(" · "),description:item.address||"",city,country,area:item.suburb||item.area||business?.area||"",address:item.address||"",image:marketplaceMedia(business || item).src,href:`/place/${encodeURIComponent(item.businessId||"")}`,business,searchText:[item.branchName,item.name,item.displayName,item.address,item.suburb,item.area,item.city,business?.name].filter(Boolean).join(" ")};}
function serviceMatches(service,business={},result={}){ return serviceMatchesMarketplaceBusiness(service, { ...business, category: business.category || result.category }); }
function score(record,queryTokens){
  // Keep exact matches ahead of merchandising. No synthetic stars or reviews.
  const ranked = record.type === "business" ? marketplaceRank(record) : record.type === "place" && record.business ? marketplaceRank(record.business) : null;
  if(!queryTokens.length) return record.type==="business" ? 20+ranked.tier*12+ranked.score : record.catalogReference?15:12;
  const haystack=text(record.searchText); const title=text(record.title);let value=0;
  for(const token of queryTokens){if(title===token)value+=50;else if(title.startsWith(token))value+=30;else if(title.includes(token))value+=20;if(haystack.includes(token))value+=8;}
  if(ranked) value+=ranked.tier*2+Math.max(-20,Math.min(10,ranked.score/3));
  if(record.catalogReference)value-=1;
  return value;
}

export async function GET(request){
 try{
  await verifyAppCheckRequest(request,{required:false});
  const rate=await enforceRateLimit(request,{key:"public-search",limit:120,windowMs:60_000});
  const url=new URL(request.url),query=String(url.searchParams.get("q")||"").trim(),queryTokens=words(query),city=text(url.searchParams.get("city")),service=text(url.searchParams.get("service")),type=text(url.searchParams.get("type"));
  const country=normalizeCountryCode(url.searchParams.get("country"))||countryForCity(city)?.country?.code||"";
  const max=Math.min(Math.max(Number(url.searchParams.get("limit")||40),1),80);
  if(!country)return Response.json({ok:true,results:[],total:0,counts:{},requiresLocation:true},{headers:{"Cache-Control":"private, max-age=0","X-RateLimit-Remaining":String(rate.remaining)}});
  const {db}=getAdminServices();
  const [businessSnap,productSnap,branchSnap,showUnclaimed,settingsSnap]=await Promise.all([db.collection("businesses").where("public","==",true).limit(700).get(),db.collection("products").where("published","==",true).limit(2000).get(),db.collection("branches").where("public","==",true).limit(1400).get(),unclaimedPublicationEnabled(db),db.collection("platformSettings").doc("global").get()]);
  const settings=settingsSnap.exists?settingsSnap.data()||{}:{};
  if(service&&country)requireServiceDiscoverable(settings,{service,country,city});
  const serviceVisible=(business)=>{const profile=marketplaceProfile(business);const localCity=business.city||city;const c=normalizeCountryCode(business.country)||countryForCity(localCity)?.country?.code||country;if(!c||!["eat","shop","book","events"].includes(profile.service))return true;return resolveServiceAvailability(settings,{service:profile.service,country:c,city:localCity}).discoverable;};
  const firestoreBusinesses=businessSnap.docs.filter((doc)=>isMarketplaceDiscoverable(doc.data()) && canShowDirectoryRecord(doc.data(),showUnclaimed)).map((doc)=>publicBusinessRecord(doc.id,doc.data())).filter(serviceVisible);
  const open=(showUnclaimed?queryOpenPlaces({country,city,q:query,service,limit:2500}).records:[]).map((item)=>publicBusinessRecord(item.id,item)).filter(serviceVisible);
  const businesses=mergeCuratedWithFirestore(open,firestoreBusinesses).filter((business)=>{const businessCountry=normalizeCountryCode(business.country)||countryForCity(business.city)?.country?.code||"";return (!country||businessCountry===country)&&(!city||!text(business.city)||text(business.city)===city)&&serviceMatches(service,business);});
  const businessMap=new Map(businesses.map((business)=>[business.id,business]));
  const records=[];
  for(const business of groupMarketplaceBusinesses(businesses))records.push(businessSearchRecord(business));
  for(const doc of productSnap.docs){const raw=doc.data()||{},business=businessMap.get(raw.businessId);if(!business||!marketplaceTrust(business).commerceVerified||raw.active===false||raw.available===false||text(raw.status)==="archived")continue;const item=publicMerchantProduct(doc.id,raw,business);if(serviceMatches(service,business,item))records.push(item);}
  if(type==="place")for(const doc of branchSnap.docs){const raw=doc.data()||{},business=businessMap.get(raw.businessId);if(!business||["archived","removed"].includes(text(raw.status)))continue;records.push(branchRecord(doc,business));}
  const shopperDiscoverable=!country||resolveServiceAvailability(settings,{service:"shop",country,city}).discoverable;
  if(showUnclaimed&&shopperDiscoverable&&(!type||type==="all"||type==="product"))for(const product of queryOpenProducts({q:query,limit:Math.max(max,40)}).records)records.push({...publicCanonicalProduct(product),country,city});
  const filtered=records.filter((record)=>{const recordCity=record.city||record.business?.city||"",recordCountry=normalizeCountryCode(record.country||record.business?.country)||countryForCity(recordCity)?.country?.code||"";return (!type||type==="all"||record.type===type)&&(!country||recordCountry===country)&&(!city||!recordCity||text(recordCity)===city)&&(!queryTokens.length||queryTokens.every((token)=>text(record.searchText).includes(token)));}).map((record)=>({...record,_score:score(record,queryTokens)})).filter((record)=>!queryTokens.length||record._score>0).sort((a,b)=>b._score-a._score||String(a.title||"").localeCompare(String(b.title||""))).slice(0,max).map(({_score,...record})=>record);
  return Response.json({ok:true,results:filtered,total:filtered.length,dataAttribution:{openStreetMap:"© OpenStreetMap contributors",openFoodFacts:"Open Food Facts contributors",databaseLicense:"ODbL-1.0"}},{headers:{"Cache-Control":"public, max-age=15, stale-while-revalidate=45","X-RateLimit-Remaining":String(rate.remaining)}});
 }catch(error){return apiError(error);}
}
