import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { queryOpenPlaces, queryOpenProducts, mergeCuratedWithFirestore } from "@/lib/open-marketplace-data";
import { isMarketplaceDiscoverable, marketplaceTrust } from "@/lib/marketplace-trust";
import { publicBusinessRecord, publicCanonicalProduct, publicMerchantProduct } from "@/lib/marketplace-public";
import { marketplaceProfile, serviceMatchesMarketplaceBusiness } from "@/lib/marketplace-taxonomy";

export const runtime = "nodejs";
const text=(value)=>String(value||"").trim().toLowerCase();
const words=(value)=>text(value).replace(/[^a-z0-9\s-]/g," ").replace(/\s+/g," ").split(" ").filter((part)=>part.length>=2).slice(0,8);

function businessSearchRecord(business){const profile=marketplaceProfile(business);return {...business,type:"business",entityId:business.id,title:business.name,subtitle:[profile.displayCategory,business.area||business.city].filter(Boolean).join(" · "),displayCategory:profile.displayCategory,vertical:profile.vertical,cardMode:profile.cardMode,image:business.coverImage||business.image||business.logoUrl||"",href:`/?business=${encodeURIComponent(business.id)}`,searchText:[business.name,business.brandName,profile.displayCategory,business.category,...(business.categories||[]),business.city,business.area,business.address,...(business.tags||[]),...(business.searchTerms||[])].filter(Boolean).join(" ")};}
function branchRecord(doc,business){const item=doc.data()||{};return{id:doc.id,type:"place",entityId:doc.id,businessId:item.businessId||"",businessName:business?.name||"",title:item.branchName||item.name||item.displayName||business?.name||"Place",subtitle:[item.suburb||item.area,item.city].filter(Boolean).join(" · "),description:item.address||"",city:item.city||business?.city||"",area:item.suburb||item.area||business?.area||"",address:item.address||"",image:business?.coverImage||business?.image||"",href:`/?business=${encodeURIComponent(item.businessId||"")}`,business,searchText:[item.branchName,item.name,item.displayName,item.address,item.suburb,item.area,item.city,business?.name].filter(Boolean).join(" ")};}
function serviceMatches(service,business={},result={}){ return serviceMatchesMarketplaceBusiness(service, { ...business, category: business.category || result.category }); }
function score(record,queryTokens){if(!queryTokens.length)return record.type==="business"?20:record.catalogReference?15:12;const haystack=text(record.searchText);const title=text(record.title);let value=0;for(const token of queryTokens){if(title===token)value+=50;else if(title.startsWith(token))value+=30;else if(title.includes(token))value+=20;if(haystack.includes(token))value+=8;}if(record.commerceVerified)value+=4;if(record.catalogReference)value-=1;return value;}

export async function GET(request){
 try{
  await verifyAppCheckRequest(request,{required:false});
  const rate=await enforceRateLimit(request,{key:"public-search",limit:120,windowMs:60_000});
  const url=new URL(request.url),query=String(url.searchParams.get("q")||"").trim(),queryTokens=words(query),city=text(url.searchParams.get("city")),service=text(url.searchParams.get("service")),type=text(url.searchParams.get("type"));
  const max=Math.min(Math.max(Number(url.searchParams.get("limit")||40),1),80); const {db}=getAdminServices();
  const [businessSnap,productSnap,branchSnap]=await Promise.all([db.collection("businesses").where("public","==",true).limit(700).get(),db.collection("products").where("published","==",true).limit(2000).get(),db.collection("branches").where("public","==",true).limit(1400).get()]);
  const firestoreBusinesses=businessSnap.docs.filter((doc)=>isMarketplaceDiscoverable(doc.data())).map((doc)=>publicBusinessRecord(doc.id,doc.data()));
  const open=queryOpenPlaces({city,q:query,service,limit:2500}).records.map((item)=>publicBusinessRecord(item.id,item));
  const businesses=mergeCuratedWithFirestore(open,firestoreBusinesses).filter((business)=>(!city||!text(business.city)||text(business.city)===city)&&serviceMatches(service,business));
  const businessMap=new Map(businesses.map((business)=>[business.id,business]));
  const records=[];
  for(const business of businesses)records.push(businessSearchRecord(business));
  for(const doc of productSnap.docs){const raw=doc.data()||{},business=businessMap.get(raw.businessId);if(!business||!marketplaceTrust(business).commerceVerified||raw.active===false||raw.available===false||text(raw.status)==="archived")continue;const item=publicMerchantProduct(doc.id,raw,business);if(serviceMatches(service,business,item))records.push(item);}
  for(const doc of branchSnap.docs){const raw=doc.data()||{},business=businessMap.get(raw.businessId);if(!business||["archived","removed"].includes(text(raw.status)))continue;records.push(branchRecord(doc,business));}
  if(!type||type==="all"||type==="product")for(const product of queryOpenProducts({q:query,limit:Math.max(max,40)}).records)records.push(publicCanonicalProduct(product));
  const filtered=records.filter((record)=>(!type||type==="all"||record.type===type)&&(!city||!record.city||text(record.city)===city)&&(!queryTokens.length||queryTokens.every((token)=>text(record.searchText).includes(token)))).map((record)=>({...record,_score:score(record,queryTokens)})).filter((record)=>!queryTokens.length||record._score>0).sort((a,b)=>b._score-a._score||String(a.title||"").localeCompare(String(b.title||""))).slice(0,max).map(({_score,...record})=>record);
  return Response.json({ok:true,results:filtered,total:filtered.length,dataAttribution:{openStreetMap:"© OpenStreetMap contributors",openFoodFacts:"Open Food Facts contributors",databaseLicense:"ODbL-1.0"}},{headers:{"Cache-Control":"public, max-age=15, stale-while-revalidate=45","X-RateLimit-Remaining":String(rate.remaining)}});
 }catch(error){return apiError(error);}
}
