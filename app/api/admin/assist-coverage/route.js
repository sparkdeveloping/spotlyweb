import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { regionalServicePolicy, AFRICAN_COUNTRY_SEEDS, ASSIST_SERVICES } from "@/lib/v9-assist-regions";
export const runtime="nodejs";
const roles=["super_admin","platform_admin","operations_manager","regional_operations_manager"];
const rule=z.object({
 country:z.string().trim().regex(/^[A-Z]{2}$/),
 city:z.string().trim().max(100).default(""),
 area:z.string().trim().max(100).default(""),
 service:z.enum(["eat","shop","book"]),
 enabled:z.boolean()
}).strict();
const mutation=z.object({
 country:z.string().trim().regex(/^[A-Z]{2}$/),
 countryEnabled:z.boolean().optional(),
 service:z.enum(["eat","shop","book"]).optional(),
 serviceEnabled:z.boolean().optional(),
 rules:z.array(rule).max(150).optional()
}).strict();
export async function GET(request){
 try{
   await authenticateRequest(request,{roles});
   const {db}=getAdminServices();
   const snap=await db.collection("platformSettings").doc("global").get();
   const coverage=snap.data()?.assistCoverage||{};
   return Response.json({ok:true,coverage,countries:AFRICAN_COUNTRY_SEEDS,services:ASSIST_SERVICES}, {headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiError(error);}
}
export async function PATCH(request){
 try{
   const actor=await authenticateRequest(request,{roles}),input=mutation.parse(await request.json());
   const {db}=getAdminServices(),ref=db.collection("platformSettings").doc("global");
   let coverage;
   await db.runTransaction(async tx=>{
     const snap=await tx.get(ref);
     const current=snap.data()?.assistCoverage||{};
     const countries={...(current.countries||{})};
     const country={...(countries[input.country]||{})};
     if(input.countryEnabled!==undefined)country.enabled=input.countryEnabled;
     if(input.service!==undefined){
       if(input.serviceEnabled===undefined)throw Object.assign(new Error("Choose whether to enable this service."),{status:422});
       country.services={...(country.services||{}),[input.service]:input.serviceEnabled};
     }
     countries[input.country]=country;
     const existing=Array.isArray(current.regions)?current.regions:[];
     let regions=existing;
     if(input.rules){
       const byKey=new Map(existing.map(entry=>[JSON.stringify([entry.country,entry.city||"",entry.area||"",entry.service||""]),entry]));
       for(const rule of input.rules)byKey.set(JSON.stringify([rule.country,rule.city,rule.area,rule.service]),rule);
       regions=[...byKey.values()].slice(0,2000);
     }
     coverage={...current,countries,regions};
     tx.set(ref,{assistCoverage:coverage,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.uid},{merge:true});
     tx.create(db.collection("auditLogs").doc(),{action:"assist.coverage.updated",actorId:actor.uid,entityType:"platformSettings",entityId:"global",metadata:{country:input.country,service:input.service||null,countryEnabled:input.countryEnabled??null,rulesUpdated:input.rules?.length||0},createdAt:FieldValue.serverTimestamp()});
   });
   return Response.json({ok:true,coverage});
 }catch(error){
   if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the country and service settings."},{status:422});
   return apiError(error);
 }
}
