import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { apiError, authenticateRequest, getAdminServices } from "@/lib/firebase-admin";
import { enforceRateLimit } from "@/lib/rate-limit-server";
import { adminBusinessState } from "@/lib/admin-business-register";
import { requireNxt, serial, noStore, audit } from "@/lib/nxt-server";
import { NXT_CHANNELS, NXT_OUTCOMES, NXT_STATUSES, cleanProspect } from "@/lib/nxt-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z.object({
  action: z.enum(["create", "update", "log", "handover", "link"]),
  id: z.string().trim().max(140).optional(),
  name: z.string().trim().min(2).max(180).optional(),
  category: z.string().trim().max(140).optional(), city: z.string().trim().max(120).optional(), address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(80).optional(), email: z.union([z.literal(""), z.string().email()]).optional(),
  website: z.string().trim().max(400).optional(), description: z.string().trim().max(1400).optional(),
  contactName: z.string().trim().max(180).optional(), contactRole: z.string().trim().max(140).optional(),
  priority: z.enum(["low", "medium", "high", "urgent", ""]).optional(), status: z.enum(NXT_STATUSES).optional(),
  followUpAt: z.union([z.string().datetime(), z.null()]).optional(), nextAction: z.string().trim().max(600).optional(),
  assigneeUid: z.string().trim().max(130).optional(), reason: z.string().trim().min(8).max(600).optional(),
  businessId: z.string().trim().max(150).optional(),
  channel: z.enum(NXT_CHANNELS).optional(), outcome: z.enum(NXT_OUTCOMES).optional(),
  note: z.string().trim().max(5000).optional(), occurredAt: z.string().datetime().optional(),
  contactConsent: z.boolean().optional()
}).strict();
function err(s, code = 400) { throw Object.assign(new Error(s), { status: code }); }
const C = "nxtProspects", T = "nxtInteractions";
async function validAssignee(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists || !snap.data()?.roles?.some(r => r.startsWith("nxt_")) || ["suspended", "disabled"].includes(snap.data()?.status)) err("Assignee must be an active NXT team member.");
}
function boundedQuery(collection, cursor, limit = 80) {
  let q = collection.orderBy("createdAt", "desc").limit(limit);
  if (cursor) q = q.startAfter(cursor);
  return q;
}
export async function GET(request) {
  try {
    const actor = await authenticateRequest(request); requireNxt(actor);
    await enforceRateLimit(request, { key: "nxt_get", limit: 75, windowMs: 60_000, identity: actor.uid });
    const { db } = getAdminServices(); const u = new URL(request.url);
    const view = u.searchParams.get("view") || "overview";
    const cursor = u.searchParams.get("cursor") || "";
    const term = (u.searchParams.get("q") || "").toLowerCase().trim().slice(0, 100);
    const city = (u.searchParams.get("city") || "").toLowerCase().trim().slice(0, 70);
    const status = u.searchParams.get("status") || "";
    if (!["overview", "prospects", "directory", "activities", "detail"].includes(view)) err("Unknown view");
    if (view === "detail") {
      const id = u.searchParams.get("id") || "";
      if (!/^[\w-]{3,140}$/.test(id)) err("Invalid prospect");
      const doc = await db.collection(C).doc(id).get();
      if (!doc.exists) err("Prospect not found", 404);
      const log = await db.collection(T).where("prospectId", "==", id).limit(100).get();
      const files = await db.collection("nxtEvidence").where("prospectId", "==", id).limit(75).get();
      return noStore({ ok: true, prospect: serial(doc), activities: log.docs.map(serial).sort((a,b) => (b.occurredAt || "").localeCompare(a.occurredAt || "")), evidence: files.docs.filter(d=>d.data().status==="ready").map(d => ({ id: d.id, name:d.data().name, size:d.data().size, mime:d.data().mime, uploadedAt:serial(d).createdAt })) });
    }
    if (view === "overview") {
      const begin = new Date(Date.now() - 14 * 86_400_000);
      const [prospectCount, activityCount, directoryCount, recent, chartDocs, lead] = await Promise.all([
        db.collection(C).count().get(), db.collection(T).count().get(), db.collection("businesses").count().get(),
        db.collection(T).orderBy("createdAt", "desc").limit(14).get(),
        db.collection(T).where("createdAt", ">=", begin).orderBy("createdAt", "desc").limit(5000).get(),
        db.collection(C).orderBy("createdAt", "desc").limit(150).get()
      ]);
      const days = Array.from({length:14}, (_,i) => new Date(Date.now() - (13-i)*86400000).toISOString().slice(0,10));
      const perDay = Object.fromEntries(days.map(day=>[day,0]));
      for(const doc of chartDocs.docs) { const d=serial(doc); if(d.createdAt && perDay[d.createdAt.slice(0,10)] != null) perDay[d.createdAt.slice(0,10)]++; }
      const stages = {}, categories = {};
      for(const doc of lead.docs){const prospect=doc.data();stages[prospect.status||"new"]=(stages[prospect.status||"new"]||0)+1;categories[prospect.category||"Uncategorized"]=(categories[prospect.category||"Uncategorized"]||0)+1;}
      return noStore({ok:true, totals:{ prospects:prospectCount.data().count, activities:activityCount.data().count, directory:directoryCount.data().count },
        recent:recent.docs.map(serial), chart:days.map(date=>({date, value:perDay[date]})), chartTruncated:chartDocs.size>=5000,
        stageSample:stages,categorySample:categories,
        note:"Private NXT prospect records are separate from public business listings. Stage/category breakdowns sample the latest 150 prospects; activity chart includes up to 5,000 records from 14 days."});
    }
    const col = view === "directory" ? "businesses" : view === "activities" ? T : C;
    if (view === "activities") requireNxt(actor, "outreach");
    const size = Math.min(Math.max(Number(u.searchParams.get("limit")) || 70,10),100);
    const ref = db.collection(col);
    let last = null;
    if (cursor) { last = await ref.doc(cursor).get(); if (!last.exists) err("Cursor not found. Refresh the list."); }
    // Scan multiple bounded pages so filters never require an unbounded read.
    let queryCursor = last, scanned = 0, exhausted = false; const out=[];
    for(let page=0;page<4 && out.length<size;page++){
      const q = boundedQuery(ref,queryCursor,75);
      const batch = await q.get(); if(batch.empty){exhausted=true;break;}
      for(const doc of batch.docs){ queryCursor=doc; scanned++;
        const d=serial(doc);
        if (view === "directory") {
          const state=adminBusinessState(d);
          Object.assign(d,{ownership:state.ownership,verification:state.verification,publication:state.publication,readiness:state.next});
          // Directory is read-only; verification or transfer must use Spotly's authoritative claim flow.
          d.source=d.source?.type || "";
        }
        if(term && ![d.name,d.city,d.phone,d.email,d.category,d.contactName,d.sourceId].filter(Boolean).join(" ").toLowerCase().includes(term))continue;
        if(city && String(d.city||"").toLowerCase()!==city)continue;
        if(status && (d.status||"")!==status && (d.ownership||"")!==status)continue;
        out.push(d);if(out.length>=size)break;
      }
      if(batch.size<75){exhausted=true;break;}
    }
    return noStore({ok:true,items:out,nextCursor:exhausted?null:queryCursor?.id||null, scanned,
      note:"Filtered results are from a bounded scan. Continue to the next page to search additional records; counts shown here are not whole-platform totals."});
  } catch(e){return apiError(e);}
}
export async function POST(request) {
  try {
    const actor=await authenticateRequest(request);
    const input=inputSchema.parse(await request.json());
    requireNxt(actor, { create:"prospects", update:"prospects", log:"outreach", handover:"handover", link:"prospects" }[input.action]);
    await enforceRateLimit(request,{key:"nxt_mutation",limit:65,windowMs:60_000,identity:actor.uid});
    const {db}=getAdminServices();const now=FieldValue.serverTimestamp();
    if(input.action==="create") {
      if(!input.name)err("A business name is required.");
      const ref=db.collection(C).doc();const details=cleanProspect(input);
      if(input.businessId){const matched=await db.collection("businesses").doc(input.businessId).get();if(!matched.exists)err("Directory business not found",404);}
      await ref.create({...details,businessId:input.businessId||"",source:"nxt_manual",status:"new",assigneeUid:actor.uid,createdBy:actor.uid,createdAt:now,updatedAt:now,public:false,claimStatus:"unclaimed",verificationStatus:"unverified"});
      await audit(db,actor,"nxt.prospect_created","nxtProspect",ref.id,{source:"manual"});return noStore({ok:true,id:ref.id},201);
    }
    if(!input.id)err("Prospect ID required");
    const ref=db.collection(C).doc(input.id),old=await ref.get();if(!old.exists)err("Prospect not found",404);
    if(input.action==="update") {
      if(input.assigneeUid!==undefined)err("Use a documented handover for assignee changes.");
      // An opt-out is sticky. Only an internal Spotly administrator may reverse
      // a suppression after documenting the contact's new lawful authorization.
      if(old.data().status==="do_not_contact" && input.status && input.status!=="do_not_contact") {
        const internal=(actor.profile.roles||[]).some(r=>["admin","super_admin","platform_admin"].includes(r));
        if(!internal || !input.reason?.trim() || input.reason.trim().length<8)err("Opt-out removal requires a Spotly administrator and a documented authorization reason.",403);
      }
      const fields=cleanProspect(input);
      if(input.status)fields.status=input.status;
      if(input.followUpAt!==undefined)fields.followUpAt=input.followUpAt?new Date(input.followUpAt):null;
      if(!Object.keys(fields).length)err("No changes provided");
      await ref.update({...fields,updatedAt:now,updatedBy:actor.uid});
      await audit(db,actor,"nxt.prospect_updated","nxtProspect",ref.id,{fields:Object.keys(fields),optOutOverrideReason:old.data().status==="do_not_contact"&&input.status!=="do_not_contact"?input.reason||"":null});
      return noStore({ok:true});
    }
    if(input.action==="handover") {
      if(!input.assigneeUid || !input.reason)err("Choose a team member and document the handover reason.");
      await validAssignee(db,input.assigneeUid);
      const previous=old.data().assigneeUid||"";
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);if(!fresh.exists)err("Prospect missing",404);
        tx.update(ref,{assigneeUid:input.assigneeUid,updatedAt:now,updatedBy:actor.uid});
        tx.create(db.collection(T).doc(),{prospectId:ref.id,kind:"handover",channel:"other",outcome:"connected",note:input.reason,previousAssignee:previous,assigneeUid:input.assigneeUid,actorUid:actor.uid,createdAt:now,occurredAt:now});
      });
      await audit(db,actor,"nxt.handover","nxtProspect",ref.id,{from:previous,to:input.assigneeUid});
      return noStore({ok:true});
    }
    if(input.action==="link") {
      if(!input.businessId)err("Select a directory business.");
      const b=await db.collection("businesses").doc(input.businessId).get();if(!b.exists)err("No directory business has that ID.",404);
      await ref.update({businessId:b.id,updatedAt:now,updatedBy:actor.uid});
      await audit(db,actor,"nxt.directory_linked","nxtProspect",ref.id,{businessId:b.id});
      return noStore({ok:true,note:"Linked to an existing business record. No owner, claim, publication or verification was changed."});
    }
    if(input.action==="log") {
      if(!input.channel || !input.outcome || !input.note?.trim())err("Channel, outcome and call/visit notes are required.");
      const occurred=input.occurredAt?new Date(input.occurredAt):new Date();if(+occurred>Date.now()+300000)err("Activity cannot occur in the future.");
      const activity=db.collection(T).doc(randomUUID());
      const patch={updatedAt:now,updatedBy:actor.uid,contactedAt:now};
      if(input.followUpAt!==undefined)patch.followUpAt=input.followUpAt?new Date(input.followUpAt):null;
      if(input.outcome==="opt_out")patch.status="do_not_contact";
      else if(input.outcome==="interested")patch.status="interested";
      else if(input.outcome==="meeting_booked")patch.status="meeting";
      else if(old.data().status==="new")patch.status="attempted";
      await db.runTransaction(async tx=>{
        const current=await tx.get(ref);if(!current.exists)err("Prospect missing",404);
        if(current.data().status==="do_not_contact" && input.outcome!=="opt_out")err("Contact is opted out. Do not log new outreach without a reviewed status change.",403);
        tx.create(activity,{prospectId:ref.id,kind:"contact",channel:input.channel,outcome:input.outcome,note:input.note,actorUid:actor.uid,actorEmail:actor.email||"",occurredAt:occurred,createdAt:now,followUpAt:patch.followUpAt||null,contactConsent:input.contactConsent===true});
        tx.update(ref,patch);
      });
      await audit(db,actor,"nxt.contact_logged","nxtProspect",ref.id,{channel:input.channel,outcome:input.outcome,activityId:activity.id});
      return noStore({ok:true,id:activity.id});
    }
  }catch(e){return apiError(e);}
}
