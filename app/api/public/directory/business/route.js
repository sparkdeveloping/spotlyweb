import { apiError, getAdminServices, verifyAppCheckRequest } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { openPlaceById } from "@/lib/open-marketplace-data";
import { publicBusinessRecord } from "@/lib/marketplace-public";
import { isMarketplaceDiscoverable } from "@/lib/marketplace-trust";

export const runtime = "nodejs";
const text=(value)=>String(value||"").trim().toLowerCase();
function publicBranch(doc) { const item=doc.data()||{}; return { id:doc.id,businessId:item.businessId||"",name:item.branchName||item.name||"Location",branchName:item.branchName||"",city:item.city||"",area:item.area||item.suburb||"",suburb:item.suburb||"",address:item.address||"",phone:item.phone||"",openingHours:item.openingHours||null,coordinates:item.coordinates||item.location||null,latitude:item.latitude??null,longitude:item.longitude??null,public:item.public===true }; }

export async function GET(request) {
  try {
    await verifyAppCheckRequest(request,{required:false});
    const rate=await enforceRateLimit(request,{key:"public-business-directory-detail",limit:180,windowMs:60_000});
    const businessId=new URL(request.url).searchParams.get("businessId")||""; if(!businessId) throw Object.assign(new Error("Business ID is required."),{status:400});
    const {db}=getAdminServices(); const snapshot=await db.collection("businesses").doc(businessId).get(); const curated=openPlaceById(businessId);
    const source=snapshot.exists?snapshot.data():curated;
    if(!source||!isMarketplaceDiscoverable(source)) throw Object.assign(new Error("That business listing is not publicly available."),{status:404});
    const business=publicBusinessRecord(businessId,{...(curated||{}),...(snapshot.exists?snapshot.data():{}),curated:Boolean(curated)});
    let branches=[];
    if(snapshot.exists){const branchSnapshot=await db.collection("branches").where("businessId","==",businessId).limit(250).get(); branches=branchSnapshot.docs.filter((doc)=>doc.data()?.public===true&&!["archived","removed"].includes(text(doc.data()?.status))).map(publicBranch);}
    if(!branches.length&&business.coordinates) branches=[{id:`${businessId}-place`,businessId,name:business.name,branchName:business.area||business.city,city:business.city,area:business.area,address:business.address,phone:business.phone,openingHours:business.openingHours,coordinates:business.coordinates,latitude:business.latitude,longitude:business.longitude,public:true,curated:true}];
    return Response.json({ok:true,businessId,business,branches,dataAttribution:business.source?.type==="openstreetmap"?{openStreetMap:"© OpenStreetMap contributors",license:"ODbL-1.0",licenseUrl:"https://www.openstreetmap.org/copyright"}:null},{headers:{"Cache-Control":"public, max-age=20, stale-while-revalidate=60","X-RateLimit-Remaining":String(rate.remaining)}});
  } catch(error){return apiError(error);}
}
