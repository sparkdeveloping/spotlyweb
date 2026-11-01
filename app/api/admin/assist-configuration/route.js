import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { paynowCredentialsConfigured } from "@/lib/paynow-server";
import { independentShoppingFlags } from "@/lib/independent-shopping";
export const runtime = "nodejs";
const roles = ["super_admin","platform_admin","operations_manager","finance_admin"];
const schema = z.object({ browseEnabled:z.boolean(),requestEnabled:z.boolean(),paymentCollectionEnabled:z.boolean(),enabled:z.boolean(),providerReviewed:z.boolean(),driverDispatchEnabled:z.boolean(),manualFloatAttestationEnabled:z.boolean(),refundReconciliationEnabled:z.boolean(),closeoutEnabled:z.boolean() }).strict();
function publicConfiguration(settings = {}) {
  const flags = independentShoppingFlags(settings), finance = settings.assistFinance || {};
  return { ...flags,paymentCollectionEnabled:settings.independentShopping?.paymentCollectionEnabled===true,
    ...Object.fromEntries(["enabled","providerReviewed","driverDispatchEnabled","manualFloatAttestationEnabled","refundReconciliationEnabled","closeoutEnabled"].map(key=>[key,finance[key]===true])) };
}
export async function GET(request) {
  try {
    const actor=await authenticateRequest(request,{roles});
    const {db}=getAdminServices();
    const [settings,configured]=await Promise.all([db.collection("platformSettings").doc("global").get(),paynowCredentialsConfigured("USD")]);
    return Response.json({ok:true,configuration:publicConfiguration(settings.data()),providerConfigured:configured,canConfigure:actor.profile?.roles?.some(role=>["super_admin","platform_admin"].includes(role))===true},{headers:{"Cache-Control":"private, no-store"}});
  } catch(error) { return apiError(error); }
}
export async function PATCH(request) {
  try {
    const actor=await authenticateRequest(request,{roles:["super_admin","platform_admin"]});
    await enforceRateLimit(request,{key:"assist-configuration",limit:30,windowMs:60_000,identity:actor.uid});
    const input=schema.parse(await request.json());
    if(input.paymentCollectionEnabled && (!input.enabled||!input.providerReviewed||!input.driverDispatchEnabled||!input.manualFloatAttestationEnabled||!input.refundReconciliationEnabled||!input.closeoutEnabled)) throw Object.assign(new Error("Complete the payment review, shopper, purchasing-float, refund and closeout settings before enabling payment collection."),{status:422});
    if(input.paymentCollectionEnabled&&!await paynowCredentialsConfigured("USD"))throw Object.assign(new Error("Configure Paynow USD in Platform integrations before enabling payment collection."),{status:422});
    const {db}=getAdminServices(),ref=db.collection("platformSettings").doc("global");
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref),old=snap.data()||{};
      const {browseEnabled,requestEnabled,paymentCollectionEnabled,...finance}=input;
      tx.set(ref,{...old,independentShopping:{...(old.independentShopping||{}),browseEnabled,requestEnabled,paymentCollectionEnabled},assistFinance:{...(old.assistFinance||{}),...finance},updatedBy:actor.uid,updatedAt:FieldValue.serverTimestamp()});
      tx.create(db.collection("auditLogs").doc(),{action:"assist.configuration.updated",actorId:actor.uid,entityType:"platformSettings",entityId:"global",metadata:{before:publicConfiguration(old),after:input},createdAt:FieldValue.serverTimestamp()});
    });
    return Response.json({ok:true,configuration:input});
  } catch(error) { if(error instanceof z.ZodError)return Response.json({ok:false,error:"Review the Assist settings."},{status:422});return apiError(error); }
}
