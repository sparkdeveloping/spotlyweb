import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { requireNxt, noStore, audit } from "@/lib/nxt-server";
import { canDelegateNxtRole, NXT_ROLES, nxtRole } from "@/lib/nxt-policy";
export const runtime="nodejs";
const change=z.object({email:z.string().email().max(254),role:z.enum(["nxt_manager","nxt_supervisor","nxt_outreach","nxt_analyst","none"])}).strict();
export async function GET(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"read");
  const {db}=getAdminServices();
  const groups=await Promise.all(Object.keys(NXT_ROLES).map(role=>db.collection("users").where("roles","array-contains",role).limit(150).get()));
  const people=new Map();groups.forEach((snap,i)=>snap.docs.forEach(doc=>{const d=doc.data();people.set(doc.id,{uid:doc.id,name:d.displayName||"",email:d.email||"",role:Object.keys(NXT_ROLES)[i],status:d.status||"active"});}));
  return noStore({ok:true,members:[...people.values()].sort((a,b)=>a.name.localeCompare(b.name)),note:"Only active NXT roles have workspace access. New employees must create a Spotly account before assignment."});
 }catch(e){return apiError(e);}
}
export async function POST(request){
 try{
  const actor=await authenticateRequest(request);requireNxt(actor,"team");const body=change.parse(await request.json());
  const isAdmin=(actor.profile.roles||[]).some(r=>["admin","super_admin","platform_admin"].includes(r));
  if(body.role!=="none"&&!canDelegateNxtRole(actor.profile,body.role))throw Object.assign(new Error("Only Spotly can grant NXT Lead access. NXT Leads can grant scoped team roles."),{status:403});
  const {db,auth}=getAdminServices();const account=await auth.getUserByEmail(body.email.toLowerCase());
  if(!account.emailVerified)throw Object.assign(new Error("The employee must verify their Spotly email before joining NXT."),{status:400});
  const ref=db.collection("users").doc(account.uid);
  await db.runTransaction(async tx=>{
   const previous=await tx.get(ref);if(!previous.exists)throw Object.assign(new Error("The user must first complete Spotly registration."),{status:404});
   const old=previous.data();const roles=Array.isArray(old.roles)?old.roles:[];
   if(!isAdmin&&roles.includes("nxt_manager"))throw Object.assign(new Error("NXT Lead status can only be changed by Spotly administrators."),{status:403});
   if(!isAdmin&&body.role==="none"&&nxtRole(old)==="nxt_manager")throw Object.assign(new Error("Cannot remove another NXT Lead."),{status:403});
   const next=roles.filter(r=>!Object.hasOwn(NXT_ROLES,r));if(body.role!=="none")next.push(body.role);
   tx.update(ref,{roles:next,updatedAt:FieldValue.serverTimestamp(),updatedBy:actor.uid});
   tx.create(db.collection("auditLogs").doc(),{action:"nxt.team_access_changed",actorId:actor.uid,entityType:"user",entityId:account.uid,metadata:{previousNxtRole:nxtRole(old),nextNxtRole:body.role},createdAt:FieldValue.serverTimestamp()});
  });
  return noStore({ok:true,uid:account.uid});
 }catch(e){return apiError(e);}
}
