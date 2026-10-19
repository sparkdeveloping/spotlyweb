import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requirePlatformPermission } from "@/lib/access-control-server";
import { AFRICAN_COUNTRIES, AFRICAN_COUNTRY_CODES } from "@/lib/africa-geo";

export const runtime = "nodejs";
const schema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/),
  enabled: z.boolean(),
  cities: z.array(z.string().trim().min(2).max(120)).max(100)
}).strict();

export async function GET(request) {
  try {
    const user=await authenticateRequest(request);
    requirePlatformPermission(user,"operations.read",{roles:["super_admin","platform_admin","operations_manager"]});
    const { db }=getAdminServices();
    const snap=await db.collection("platformSettings").doc("global").get();
    const launch=snap.data()?.launch||{};
    return Response.json({ok:true,countries:AFRICAN_COUNTRIES,
      supportedCountries:Array.isArray(launch.supportedCountries)?launch.supportedCountries:["ZW"],
      countryCities:launch.countryCities||{},
      notice:"Adding a country or city enables location selection and directory management. It does not enable payment providers, merchant commerce or unaffiliated purchases."
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return apiError(error);}
}

export async function PATCH(request) {
  try {
    const actor=await authenticateRequest(request);
    requirePlatformPermission(actor,"admin.configuration",{roles:["super_admin","platform_admin","operations_manager"]});
    const input=schema.parse(await request.json());
    if(!AFRICAN_COUNTRY_CODES.has(input.country))throw Object.assign(new Error("Choose an African country."),{status:422});
    const cityList=[...new Set(input.cities.map((city)=>city.trim()).filter(Boolean))];
    if(input.enabled&&!cityList.length)throw Object.assign(new Error("Add at least one city before enabling this country."),{status:422});
    const { db }=getAdminServices();
    const ref=db.collection("platformSettings").doc("global");
    await db.runTransaction(async(tx)=>{
      const snap=await tx.get(ref);
      const old=snap.data()?.launch||{};
      const oldCodes=Array.isArray(old.supportedCountries)?old.supportedCountries:["ZW"];
      const countryCodes=input.enabled?[...new Set([...oldCodes,input.country])]:
        oldCodes.filter((country)=>country!==input.country);
      const cities={...(old.countryCities||{}),[input.country]:cityList};
      tx.set(ref,{
        launch:{...old,supportedCountries:countryCodes,countryCities:cities},
        updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.uid
      },{merge:true});
    });
    await db.collection("auditLogs").add({actorId:actor.uid,action:"geography.country.updated",
      entityType:"country",entityId:input.country,metadata:{enabled:input.enabled,cities:cityList},
      createdAt:FieldValue.serverTimestamp()});
    return Response.json({ok:true,country:input.country,enabled:input.enabled,cities:cityList});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the country and supported city names."},{status:422});
    return apiError(error);
  }
}
