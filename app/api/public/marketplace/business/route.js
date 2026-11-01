import { unclaimedPublicationEnabled } from "@/lib/directory-publication-server";
import { canShowDirectoryRecord } from "@/lib/nxt-policy";
import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { openPlaceById } from "@/lib/open-marketplace-data";
import { publicBusinessRecord, plainDate } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable, marketplaceTrust } from "@/lib/marketplace-trust";
import { publicBusinessGroup } from "@/lib/business-group-server";
import { directoryShoppingStore } from "@/lib/directory-shopping-server";
import { independentShoppingFlags } from "@/lib/independent-shopping";

export const runtime = "nodejs";
const text=(value)=>String(value||"").trim().toLowerCase();
function publicBranch(doc){const item=doc.data()||{};return{id:doc.id,businessId:item.businessId||"",branchName:item.branchName||item.name||item.displayName||"Location",name:item.branchName||item.name||item.displayName||"Location",city:item.city||"",suburb:item.suburb||item.area||"",area:item.suburb||item.area||"",address:item.address||"",phone:item.phone||item.contactPhone||"",status:item.status||"active",public:item.public===true,fulfilment:Array.isArray(item.fulfilment)?item.fulfilment:[],openingHours:item.openingHours||{},specialHours:item.specialHours||item.openingExceptions||[],pickup:item.pickup||{},paymentMethods:Array.isArray(item.paymentMethods)?item.paymentMethods:[],acceptedCurrencies:Array.isArray(item.acceptedCurrencies)?item.acceptedCurrencies:["USD"],delivery:item.delivery?{enabled:item.delivery.enabled===true,paused:item.delivery.paused===true,fee:Number(item.delivery.fee||0),radiusKm:Number(item.delivery.radiusKm||0)}:null,location:item.location&&Number.isFinite(Number(item.location.lat))&&Number.isFinite(Number(item.location.lng))?{lat:Number(item.location.lat),lng:Number(item.location.lng)}:null};}
function publicProduct(doc){const item=doc.data()||{};return{id:doc.id,businessId:item.businessId,name:item.name||"Product",description:item.description||"",category:item.category||"General",image:item.image||item.imageUrl||"",brand:item.brand||"",variant:item.variant||"",packSize:item.packSize||"",unit:item.unit||"",currency:item.currency||"USD",price:Number(item.price||0),prices:item.prices||{},compareAtPrice:item.compareAtPrice==null?null:Number(item.compareAtPrice),sku:item.sku||"",stockMode:item.stockMode||"status",stockQuantity:Number(item.stockQuantity||0),stockStatus:item.stockStatus||"in_stock",active:item.active!==false,available:item.available!==false,pickupEligible:item.pickupEligible!==false,maxQuantity:item.maxQuantity==null?null:Number(item.maxQuantity),published:item.published===true,itemType:item.itemType||"product",startAt:plainDate(item.startAt),endAt:plainDate(item.endAt),venue:item.venue||""};}

export async function GET(request){
 try{
  await verifyAppCheckRequest(request,{required:false}); const rate=await enforceRateLimit(request,{key:"public-marketplace-business",limit:180,windowMs:60_000});
  const businessId=new URL(request.url).searchParams.get("businessId")||""; if(!businessId) throw Object.assign(new Error("Business ID is required."),{status:400});
  const {db}=getAdminServices(); const [businessSnapshot,branchSnapshot,productSnapshot]=await Promise.all([db.collection("businesses").doc(businessId).get(),db.collection("branches").where("businessId","==",businessId).limit(100).get(),db.collection("products").where("businessId","==",businessId).limit(1000).get()]);
  const curated=openPlaceById(businessId); const source=businessSnapshot.exists?{...(curated||{}),...businessSnapshot.data()}:curated; const showUnclaimed=await unclaimedPublicationEnabled(db);
  if(!source||!isMarketplaceDiscoverable(source)||!(businessSnapshot.exists?canShowDirectoryRecord(source,showUnclaimed):showUnclaimed)) throw Object.assign(new Error("This business is not publicly available."),{status:404});
  const business=await publicBusinessGroup(db,businessId,{...source,curated:Boolean(curated)},showUnclaimed); const trust=marketplaceTrust(source);
  if (business.assistRequestAvailable) {
    const config = (await db.collection("platformSettings").doc("global").get()).data() || {};
    const flags = independentShoppingFlags(config);
    const found = flags.browseEnabled ? await directoryShoppingStore(db, {businessId,branchId:branchSnapshot.docs.find(doc=>doc.data()?.public===true&&!["archived","removed"].includes(text(doc.data()?.status)))?.id || "",settings:config,source}) : null;
    business.assistRequestAvailable = Boolean(found?.store);
    business.assistCatalogue = found?.store ? {store:found.store,requestEnabled:flags.requestEnabled} : null;
  }
  let branches=branchSnapshot.docs.filter((doc)=>doc.data()?.public===true&&!["archived","removed"].includes(text(doc.data()?.status))).map(publicBranch);
  if(!trust.commerceVerified) branches=branches.map((branch)=>({...branch,fulfilment:[],pickup:{},paymentMethods:[],delivery:null}));
  if(!branches.length&&business.coordinates)branches=[{id:`${businessId}-place`,businessId,branchName:business.area||business.city||"Location",name:business.name,city:business.city,area:business.area,suburb:business.suburb,address:business.address,phone:business.phone,status:"listed",public:true,fulfilment:[],openingHours:business.openingHours||{},specialHours:[],pickup:{},paymentMethods:[],acceptedCurrencies:[],delivery:null,location:{lat:business.latitude,lng:business.longitude},curated:true}];
  const products=trust.commerceVerified?productSnapshot.docs.map(publicProduct).filter((item)=>item.published&&item.active&&item.available):[];
  return Response.json({ok:true,business,branches,products,transactional:trust.commerceVerified,claimAvailable:trust.discovery.claim,dataAttribution:business.source?.type==="openstreetmap"?{openStreetMap:"© OpenStreetMap contributors",license:"ODbL-1.0",licenseUrl:"https://www.openstreetmap.org/copyright"}:null},{headers:{"Cache-Control":"public, max-age=20, stale-while-revalidate=60","X-RateLimit-Remaining":String(rate.remaining)}});
 }catch(error){return apiError(error);}
}
